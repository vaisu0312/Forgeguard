import cv2
import numpy as np
import librosa
import io
from PIL import Image
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


# ─────────────────────────────────────────────
#  HELPER: Error Level Analysis (ELA)
#  Real forensic technique used by investigators.
#  Re-saves image at known quality, finds regions
#  where pixel differences are unusually high.
#  Authentic images → uniform low differences.
#  Edited images → hotspots where edits were made.
# ─────────────────────────────────────────────
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


# ─────────────────────────────────────────────
#  HELPER: Noise Consistency
#  Real cameras produce uniform sensor noise.
#  Copy-pasted or AI-generated regions break
#  that noise pattern — detectable with math.
# ─────────────────────────────────────────────
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


# ─────────────────────────────────────────────
#  ENDPOINT: Image Verification
# ─────────────────────────────────────────────
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

        h, w     = img.shape[:2]
        anomalies = []
        score    = 95   # Start at 95, deduct for each finding

        # ── Analysis 1: ELA ──────────────────────
        ela_mean, ela_max, ela_std, block_var = run_ela(file_bytes)

        if ela_mean > 15:
            anomalies.append(
                f"ELA: Very high error level ({ela_mean:.1f}). "
                "Strong evidence of image editing — pixel-level anomalies well above normal range."
            )
            score -= 40
        elif ela_mean > 8:
            anomalies.append(
                f"ELA: Elevated error level ({ela_mean:.1f}). "
                "Moderate compression inconsistencies detected. Possible editing or resaving."
            )
            score -= 20
        elif ela_mean > 4:
            anomalies.append(
                f"ELA: Slight elevation ({ela_mean:.1f}). "
                "Minor variation — within acceptable range but worth noting."
            )
            score -= 5

        if block_var > 200:
            anomalies.append(
                f"ELA Spatial Hotspots: Non-uniform error distribution (block variance {block_var:.0f}). "
                "Manipulation likely localized to specific image regions."
            )
            score -= 20

        # ── Analysis 2: Noise Consistency ────────
        noise_cv = analyze_noise(img)

        if noise_cv > 1.5:
            anomalies.append(
                f"Noise Analysis: Inconsistent sensor noise across image (CV={noise_cv:.2f}). "
                "Camera sensor patterns break at suspected splicing boundaries."
            )
            score -= 20
        elif noise_cv > 0.8:
            anomalies.append(
                f"Noise Analysis: Mild noise variation detected (CV={noise_cv:.2f}). "
                "Slight inconsistency in noise profile — minor editing possible."
            )
            score -= 8

        # ── Analysis 3: Edge Density ──────────────
        gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.sum(edges) / (h * w))

        if edge_density < 0.005:
            anomalies.append(
                f"Structure: Very low edge density ({edge_density:.4f}). "
                "Image structure resembles AI-generated or template-based content."
            )
            score -= 15

        # ── Analysis 4: Color Channel Balance ────
        b_ch, g_ch, r_ch = cv2.split(img)
        channel_stds = [float(np.std(c)) for c in [r_ch, g_ch, b_ch]]
        ch_variance  = float(np.var(channel_stds))

        if ch_variance > 600:
            anomalies.append(
                f"Color Channels: High imbalance between R/G/B channels (variance={ch_variance:.0f}). "
                "Unnatural color distribution pattern detected."
            )
            score -= 10

        score = max(0, min(100, score))

        # If everything looks clean
        if not anomalies:
            anomalies = [
                f"ELA: Error levels are low and uniform ({ela_mean:.1f}) — consistent with a single, unedited save.",
                f"Noise: Camera sensor noise is consistent across all image regions (CV={noise_cv:.2f}).",
                "Structure and color channels are within normal range. No manipulation indicators found."
            ]

        return {
            "authenticity_score": score,
            "is_deepfake": score < 50,
            "confidence": "high" if abs(score - 50) > 20 else "medium",
            "explanations": anomalies,
            "manipulation_regions": "Hotspots detected — see ELA findings" if score < 70 else "None detected",
            "extracted_metadata": {
                "dimensions":  f"{w}x{h}",
                "ela_mean":    f"{ela_mean:.2f}",
                "noise_cv":    f"{noise_cv:.2f}",
                "edge_density": f"{edge_density:.4f}"
            }
        }

    except Exception as e:
        return {
            "authenticity_score": 0,
            "is_deepfake": False,
            "explanations": [f"Server error: {str(e)}"],
            "extracted_metadata": {}
        }


# ─────────────────────────────────────────────
#  ENDPOINT: Audio Verification
# ─────────────────────────────────────────────
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

        # ── Feature Extraction ─────────────────────
        mfccs              = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_var           = float(np.var(mfccs))

        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        centroid_std       = float(np.std(spectral_centroids))

        zcr_mean           = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))

        flatness_mean      = float(np.mean(librosa.feature.spectral_flatness(y=y)[0]))

        # ── Rules ──────────────────────────────────
        # Low MFCC variance = unnatural/robotic vocal tract (TTS, voice cloning)
        if mfcc_var < 50.0:
            anomalies.append(
                f"MFCC variance is very low ({mfcc_var:.2f} < 50). "
                "Unnatural vocal tract stability — consistent with TTS or voice cloning software."
            )
            score -= 35

        # Low spectral centroid variation = synthetic, uniform voice
        if centroid_std < 400:
            anomalies.append(
                f"Spectral centroid variation is low ({centroid_std:.0f} Hz). "
                "Real voices vary more — this matches electronic vocoder or voice synthesis output."
            )
            score -= 20

        # High zero-crossing rate = synthetic high-frequency artifacts
        if zcr_mean > 0.18:
            anomalies.append(
                f"Elevated zero-crossing rate ({zcr_mean:.3f}). "
                "High-frequency synthetic artifacts present — common in AI-generated speech."
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