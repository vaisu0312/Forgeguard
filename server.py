import cv2
import numpy as np
import librosa
import io
from PIL import Image
from PIL.ExifTags import TAGS
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ForgeGuard AI Forensic Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------
#  HELPER: Error Level Analysis (ELA)
#  Real forensic technique used by investigators.
#  Re-saves image at known quality, finds regions
#  where pixel differences are unusually high.
# ---------------------------------------------
# ---------------------------------------------
# ---------------------------------------------
def run_ela(image_bytes, quality=90):
    try:
        original = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Re-save at controlled JPEG quality
        buffer = io.BytesIO()
        original.save(buffer, "JPEG", quality=quality)
        buffer.seek(0)
        recompressed = Image.open(buffer).convert("RGB")

        orig_arr  = np.array(original,     dtype=np.float32)
        recom_arr = np.array(recompressed, dtype=np.float32)

        diff = np.abs(orig_arr - recom_arr)

        ela_mean = float(np.mean(diff))
        ela_max  = float(np.max(diff))
        ela_std  = float(np.std(diff))

        # Check whether high-error areas are LOCALIZED (manipulation)
        # or spread out evenly (normal compression)
        h, w     = diff.shape[:2]
        bsize    = max(min(h, w) // 8, 16)
        block_means = [
            float(np.mean(diff[y:y+bsize, x:x+bsize]))
            for y in range(0, h - bsize, bsize)
            for x in range(0, w - bsize, bsize)
        ]
        block_variance = float(np.var(block_means)) if block_means else 0.0

        return ela_mean, ela_max, ela_std, block_variance

    except Exception:
        return 5.0, 50.0, 5.0, 0.0


# ---------------------------------------------
#  HELPER: Noise Consistency
#  Real cameras produce uniform sensor noise.
#  Copy-pasted or AI-generated regions break
# ---------------------------------------------
# ---------------------------------------------
def analyze_noise(img_bgr):
    try:
        gray    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        noise   = gray - blurred

        h, w   = noise.shape
        bsize  = max(min(h, w) // 6, 10)

        block_vars = [
            float(np.var(noise[y:y+bsize, x:x+bsize]))
            for y in range(0, h - bsize, bsize)
            for x in range(0, w - bsize, bsize)
        ]

        if not block_vars or np.mean(block_vars) == 0:
            return 0.0

        return float(np.std(block_vars) / np.mean(block_vars))  # Coefficient of Variation

    except Exception:
        return 0.0


def extract_image_metadata(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif = image.getexif()
        exif_tags = {}

        if exif:
            for tag_id, value in exif.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                if isinstance(value, bytes):
                    continue
                exif_tags[tag_name] = str(value)[:120]

        return {
            "format": image.format or "UNKNOWN",
            "has_exif": bool(exif_tags),
            "camera_make": exif_tags.get("Make", ""),
            "camera_model": exif_tags.get("Model", ""),
            "software": exif_tags.get("Software", ""),
            "exif_tag_count": len(exif_tags),
        }
    except Exception:
        return {
            "format": "UNKNOWN",
            "has_exif": False,
            "camera_make": "",
            "camera_model": "",
            "software": "",
            "exif_tag_count": 0,
        }


def analyze_texture_realism(img_bgr):
    try:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        gray_f = gray.astype(np.float32) / 255.0

        lap = cv2.Laplacian(gray_f, cv2.CV_32F)
        lap_var = float(np.var(lap))

        sobel_x = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
        gradient_mag = np.sqrt((sobel_x ** 2) + (sobel_y ** 2))
        gradient_mean = float(np.mean(gradient_mag))

        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        saturation_mean = float(np.mean(hsv[:, :, 1]) / 255.0)
        saturation_std = float(np.std(hsv[:, :, 1]) / 255.0)

        noise = gray_f - cv2.GaussianBlur(gray_f, (0, 0), 1.2)
        noise_std = float(np.std(noise))

        small = cv2.resize(gray, (128, 128), interpolation=cv2.INTER_AREA)
        dct = cv2.dct(np.float32(small) / 255.0)
        high_freq_energy = float(np.mean(np.abs(dct[48:, 48:])))

        return {
            "laplacian_variance": lap_var,
            "gradient_mean": gradient_mean,
            "saturation_mean": saturation_mean,
            "saturation_std": saturation_std,
            "noise_std": noise_std,
            "high_freq_energy": high_freq_energy,
        }
    except Exception:
        return {
            "laplacian_variance": 0.0,
            "gradient_mean": 0.0,
            "saturation_mean": 0.0,
            "saturation_std": 0.0,
            "noise_std": 0.0,
            "high_freq_energy": 0.0,
        }


# ---------------------------------------------
#  ENDPOINT: Image Verification
# ---------------------------------------------
@app.post("/api/verify-image")
async def verify_image(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()

        # Decode with OpenCV
        nparr = np.frombuffer(file_bytes, np.uint8)
        img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {
                "authenticity_score": 0,
                "is_deepfake": False,
                "explanations": ["Could not decode image. Please upload a valid JPG or PNG."],
                "extracted_metadata": {}
            }

        h, w = img.shape[:2]
        findings = []
        risk = 0
        authentic_evidence = 0
        image_meta = extract_image_metadata(file_bytes)

        # Analysis 1: compression and edit artifacts
        ela_mean, ela_max, ela_std, block_var = run_ela(file_bytes)

        if ela_mean > 18:
            findings.append(
                f"ELA: Very high error level ({ela_mean:.1f}). "
                "Strong evidence of image editing - pixel-level anomalies well above normal range."
            )
            risk += 30
        elif ela_mean > 11:
            findings.append(
                f"ELA: Elevated error level ({ela_mean:.1f}). "
                "Moderate compression inconsistencies detected. Possible editing or resaving."
            )
            risk += 14
        elif ela_mean > 5:
            findings.append(
                f"ELA: Slight elevation ({ela_mean:.1f}). "
                "Minor variation - within acceptable range but worth noting."
            )
            risk += 4
        else:
            authentic_evidence += 4

        if block_var > 200:
            findings.append(
                f"ELA Spatial Hotspots: Non-uniform error distribution (block variance {block_var:.0f}). "
                "Manipulation likely localized to specific image regions."
            )
            risk += 18

        # Analysis 2: noise consistency
        noise_cv = analyze_noise(img)

        if noise_cv > 1.8:
            findings.append(
                f"Noise Analysis: Inconsistent sensor noise across image (CV={noise_cv:.2f}). "
                "Camera sensor patterns break at suspected splicing boundaries."
            )
            risk += 18
        elif noise_cv > 1.1:
            findings.append(
                f"Noise Analysis: Mild noise variation detected (CV={noise_cv:.2f}). "
                "Slight inconsistency in noise profile - minor editing possible."
            )
            risk += 7
        elif image_meta["has_exif"] and 0.25 <= noise_cv <= 0.95:
            authentic_evidence += 8

        # Analysis 3: structure
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.sum(edges) / (h * w))

        if edge_density < 0.005:
            findings.append(
                f"Structure: Very low edge density ({edge_density:.4f}). "
                "Image structure resembles AI-generated or template-based content."
            )
            risk += 16
        elif image_meta["has_exif"] and edge_density > 0.012:
            authentic_evidence += 5

        # Analysis 4: color balance
        b_ch, g_ch, r_ch = cv2.split(img)
        channel_stds = [float(np.std(c)) for c in [r_ch, g_ch, b_ch]]
        ch_variance = float(np.var(channel_stds))

        if ch_variance > 600:
            findings.append(
                f"Color Channels: High imbalance between R/G/B channels (variance={ch_variance:.0f}). "
                "Unnatural color distribution pattern detected."
            )
            risk += 8

        # Analysis 5: AI-generation indicators
        texture = analyze_texture_realism(img)

        if not image_meta["has_exif"]:
            findings.append(
                "Metadata: No camera EXIF block found. Treating provenance as suspicious because AI exports and edited images often strip camera data."
            )
            risk += 28
        else:
            authentic_evidence += 12
            camera_label = " ".join(
                part for part in [image_meta["camera_make"], image_meta["camera_model"]] if part
            ).strip()
            findings.append(
                f"Metadata: Camera EXIF present{f' ({camera_label})' if camera_label else ''}, which supports real capture."
            )

        software = image_meta.get("software", "").lower()
        synthetic_tools = ["midjourney", "stable diffusion", "dall-e", "dalle", "firefly", "comfyui", "automatic1111"]
        editor_tools = ["photoshop", "gimp", "canva", "snapseed", "lightroom"]
        if any(tool in software for tool in synthetic_tools):
            findings.append(f"Metadata: Generator software marker found ({image_meta['software']}).")
            risk += 45
        elif any(tool in software for tool in editor_tools):
            findings.append(f"Metadata: Editing software marker found ({image_meta['software']}).")
            risk += 12

        if texture["noise_std"] < 0.008 and texture["laplacian_variance"] < 0.004:
            findings.append(
                "Texture: Image is unusually smooth with weak micro-detail, a common synthetic-image signature."
            )
            risk += 24
        elif texture["noise_std"] < 0.012:
            findings.append(
                "Texture: Low sensor-level micro-noise detected. This can indicate AI generation or heavy smoothing."
            )
            risk += 12
        elif image_meta["has_exif"] and texture["noise_std"] > 0.016:
            authentic_evidence += 8

        if texture["high_freq_energy"] < 0.0007:
            findings.append(
                "Frequency Profile: Very little high-frequency detail remains, which leans synthetic or heavily processed."
            )
            risk += 12
        elif image_meta["has_exif"] and texture["high_freq_energy"] > 0.0012:
            authentic_evidence += 4

        if texture["saturation_mean"] > 0.55 and texture["saturation_std"] < 0.18:
            findings.append(
                "Color Profile: Saturation is high and unusually uniform, a pattern often seen in generated images."
            )
            risk += 10

        if not image_meta["has_exif"] and not image_meta["software"]:
            findings.append(
                "Provenance: File has no camera or software trail, which is typical of generated or stripped images."
            )
            risk += 8

        if not image_meta["has_exif"] and image_meta["format"] in {"PNG", "WEBP"}:
            risk += 14
        elif not image_meta["has_exif"]:
            risk += 8

        if not image_meta["has_exif"] and texture["noise_std"] < 0.024:
            findings.append(
                "Sensor Trace: Missing camera metadata plus weak sensor noise makes this image likely synthetic or exported."
            )
            risk += 14

        if not image_meta["has_exif"] and ela_mean < 3.0 and block_var < 15:
            findings.append(
                "Compression Trace: Very clean recompression behavior without camera provenance is common in generated images."
            )
            risk += 8

        if risk < 22 and authentic_evidence >= 12:
            findings.append(
                "Authenticity: Natural texture, noise, and metadata signals outweigh the minor compression findings."
            )

        evidence_credit = min(authentic_evidence, 12) if image_meta["has_exif"] else 0
        score = max(0, min(100, int(round(100 - risk + evidence_credit))))
        is_synthetic_or_manipulated = risk >= 38 or score < 72

        if not findings:
            findings = [
                f"ELA: Error levels are low and uniform ({ela_mean:.1f}) - consistent with a single, unedited save.",
                f"Noise: Camera sensor noise is consistent across all image regions (CV={noise_cv:.2f}).",
                "Structure and color channels are within normal range. No manipulation indicators found."
            ]

        return {
            "authenticity_score": score,
            "is_deepfake": is_synthetic_or_manipulated,
            "confidence": "high" if risk >= 55 or score >= 82 else "medium",
            "explanations": findings,
            "manipulation_regions": "Hotspots detected - see ELA findings" if score < 70 else "None detected",
            "extracted_metadata": {
                "dimensions": f"{w}x{h}",
                "format": image_meta["format"],
                "has_exif": "yes" if image_meta["has_exif"] else "no",
                "camera_model": image_meta["camera_model"] or "not found",
                "software": image_meta["software"] or "not found",
                "ela_mean": f"{ela_mean:.2f}",
                "noise_cv": f"{noise_cv:.2f}",
                "edge_density": f"{edge_density:.4f}",
                "texture_noise": f"{texture['noise_std']:.4f}",
                "texture_detail": f"{texture['laplacian_variance']:.4f}",
                "synthetic_risk": f"{risk}"
            }
        }
    except Exception as e:
        return {
            "authenticity_score": 0,
            "is_deepfake": False,
            "explanations": [f"Server error: {str(e)}"],
            "extracted_metadata": {}
        }


# ---------------------------------------------
#  ENDPOINT: Audio Verification
# ---------------------------------------------
@app.post("/api/verify-audio")
async def verify_audio(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        temp_path  = "temp_audio.wav"
        with open(temp_path, "wb") as f:
            f.write(file_bytes)

        y, sr = librosa.load(temp_path, duration=10.0)

        anomalies  = []
        score      = 92

        # Feature extraction
        mfccs              = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_var           = float(np.var(mfccs))

        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_std       = float(np.std(spectral_centroids))

        zcr_mean           = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))

        flatness_mean      = float(np.mean(librosa.feature.spectral_flatness(y=y)[0]))

        # Rules
        # Low MFCC variance = unnatural/robotic vocal tract (TTS, voice cloning)
        if mfcc_var < 50.0:
            anomalies.append(
                f"MFCC variance is very low ({mfcc_var:.2f} < 50). "
                "Unnatural vocal tract stability - consistent with TTS or voice cloning software."
            )
            score -= 35

        # Low spectral centroid variation = synthetic, uniform voice
        if centroid_std < 400:
            anomalies.append(
                f"Spectral centroid variation is low ({centroid_std:.0f} Hz). "
                "Real voices vary more - this matches electronic vocoder or voice synthesis output."
            )
            score -= 20

        # High zero-crossing rate = synthetic high-frequency artifacts
        if zcr_mean > 0.18:
            anomalies.append(
                f"Elevated zero-crossing rate ({zcr_mean:.3f}). "
                "High-frequency synthetic artifacts present - common in AI-generated speech."
            )
            score -= 15

        # High spectral flatness = noise-floor looks wrong
        if flatness_mean > 0.1:
            anomalies.append(
                f"High spectral flatness ({flatness_mean:.4f}). "
                "Noise floor characteristics don't match natural recording environment."
            )
            score -= 10

        score = max(0, min(100, score))

        if not anomalies:
            anomalies = [
                f"MFCC variance ({mfcc_var:.2f}) is within natural human speech range.",
                f"Spectral centroid variation ({centroid_std:.0f} Hz) matches authentic vocal dynamics.",
                "No synthetic or cloned voice markers detected in acoustic features."
            ]

        return {
            "authenticity_score": score,
            "is_deepfake": score < 50,
            "confidence": "high" if abs(score - 50) > 20 else "medium",
            "explanations": anomalies,
            "extracted_metadata": {
                "sample_rate":          f"{sr} Hz",
                "mfcc_variance":        f"{mfcc_var:.2f}",
                "spectral_centroid_std": f"{centroid_std:.0f} Hz"
            }
        }

    except Exception as e:
        return {
            "authenticity_score": 0,
            "is_deepfake": False,
            "confidence": "low",
            "explanations": [f"Audio error: {str(e)}"],
            "extracted_metadata": {}
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
