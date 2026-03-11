// ===== BioMotion Lab – Smoothing Filters =====

// ---- Exponential Moving Average (EMA) ----
// Applied per keypoint coordinate for real-time display.
// alpha: 0.0 = max smoothing, 1.0 = no smoothing

const emaState = {}; // { 'left_knee_x': prevValue, ... }

export function emaSmooth(value, key, alpha) {
  if (emaState[key] === undefined || emaState[key] === null) {
    emaState[key] = value;
    return value;
  }
  const smoothed = alpha * value + (1 - alpha) * emaState[key];
  emaState[key] = smoothed;
  return smoothed;
}

export function resetEmaState() {
  for (const key of Object.keys(emaState)) {
    delete emaState[key];
  }
}

// Smooth all keypoints in a pose object
export function smoothKeypoints(rawKeypoints, alphaValue) {
  const smoothed = {};
  for (const [name, pt] of Object.entries(rawKeypoints)) {
    smoothed[name] = {
      x: emaSmooth(pt.x, `${name}_x`, alphaValue),
      y: emaSmooth(pt.y, `${name}_y`, alphaValue),
      score: pt.score,
    };
  }
  return smoothed;
}

// Convert slider value (1–5) to alpha
export function sliderToAlpha(sliderVal) {
  // 1 = most smooth (alpha 0.12), 5 = least smooth (alpha 0.55)
  const map = { 1: 0.12, 2: 0.20, 3: 0.30, 4: 0.42, 5: 0.55 };
  return map[sliderVal] ?? 0.30;
}

export function sliderToLabel(sliderVal) {
  const map = { 1: 'Maximum', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Off' };
  return map[sliderVal] ?? 'Medium';
}

// ---- Savitzky-Golay Filter (post-processing) ----
// windowSize must be odd, polynomialOrder < windowSize
export function savitzkyGolay(data, windowSize = 5, polyOrder = 2) {
  if (!data || data.length < windowSize) return data;
  const half = Math.floor(windowSize / 2);
  const coeffs = sgCoefficients(windowSize, polyOrder);
  const result = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    if (data[i] === null || data[i] === undefined) { result[i] = null; continue; }
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const idx = Math.min(Math.max(i - half + j, 0), data.length - 1);
      const v = data[idx];
      sum += (v !== null && v !== undefined ? v : data[i]) * coeffs[j];
    }
    result[i] = sum;
  }
  return result;
}

// Compute Savitzky-Golay convolution coefficients
function sgCoefficients(windowSize, polyOrder) {
  const half = Math.floor(windowSize / 2);
  // Build the Vandermonde matrix
  const A = [];
  for (let i = -half; i <= half; i++) {
    const row = [];
    for (let p = 0; p <= polyOrder; p++) {
      row.push(Math.pow(i, p));
    }
    A.push(row);
  }
  // Least squares: (A^T A)^-1 A^T, take first row (smoothing)
  const At = transpose(A);
  const AtA = matMul(At, A);
  const AtAinv = invertMatrix(AtA);
  if (!AtAinv) return uniformCoeffs(windowSize);
  const pinv = matMul(AtAinv, At);
  // Return zeroth-order row (first row of pinv)
  return pinv[0];
}

function uniformCoeffs(n) {
  return new Array(n).fill(1 / n);
}

function transpose(M) {
  return M[0].map((_, ci) => M.map(row => row[ci]));
}

function matMul(A, B) {
  const rows = A.length, cols = B[0].length, inner = B.length;
  const C = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (let k = 0; k < inner; k++)
        C[r][c] += A[r][k] * B[k][c];
  return C;
}

function invertMatrix(M) {
  const n = M.length;
  const aug = M.map((row, i) => {
    const id = new Array(n).fill(0);
    id[i] = 1;
    return [...row, ...id];
  });
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null; // singular
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}
