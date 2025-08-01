export function normalizeData(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  if (range === 0) return data.map(() => 0);
  
  return data.map(value => (value - min) / range);
}

export function calculateDistance(
  point1: [number, number, number], 
  point2: [number, number, number]
): number {
  return Math.sqrt(
    Math.pow(point1[0] - point2[0], 2) +
    Math.pow(point1[1] - point2[1], 2) +
    Math.pow(point1[2] - point2[2], 2)
  );
}

export function generateColorPalette(count: number): string[] {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360) / count;
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
}

export function detectOutliers(
  data: number[], 
  threshold: number = 2
): number[] {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  
  const outliers: number[] = [];
  data.forEach((value, index) => {
    if (Math.abs(value - mean) > threshold * stdDev) {
      outliers.push(index);
    }
  });
  
  return outliers;
}

export function mapValueToSize(
  value: number, 
  min: number, 
  max: number,
  minSize: number = 0.5,
  maxSize: number = 2.0
): number {
  if (max === min) return (minSize + maxSize) / 2;
  
  const normalized = (value - min) / (max - min);
  return minSize + normalized * (maxSize - minSize);
}

export function interpolateColor(
  value: number,
  min: number,
  max: number,
  startColor: string = '#0000ff',
  endColor: string = '#ff0000'
): string {
  if (max === min) return startColor;
  
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  
  // Simple linear interpolation between two colors
  const startRGB = hexToRgb(startColor);
  const endRGB = hexToRgb(endColor);
  
  if (!startRGB || !endRGB) return startColor;
  
  const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * normalized);
  const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * normalized);
  const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * normalized);
  
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
