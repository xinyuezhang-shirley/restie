/**
 * SkSL port of the puppet's WebGL fragment shader.
 * Coordinates: `xy` is in canvas points; we work in 0..1 UVs (v = xy/size)
 * and sample the frame back in points.
 */
export const PUPPET_SKSL = `
uniform shader image;
uniform float2 size;
uniform float alpha;
uniform float2 neck;
uniform float hRot;
uniform float2 hOff;
uniform float4 e0;
uniform float4 e1;
uniform float blink;
uniform float2 tB;
uniform float3 tC;
uniform float tRot;
uniform float2 l0p;
uniform float3 l0c;
uniform float3 l0;
uniform float ground;
uniform float cx;
uniform float breath;
uniform float bodyRot;
uniform float2 shift;
uniform float useHead;
uniform float3 hb;

float2 rot(float2 p, float a) {
  float c = cos(a); float s = sin(a);
  return float2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float2 limb(float2 q, float2 piv, float3 c, float3 m) {
  float w = 1.0 - smoothstep(c.z * 0.75, c.z, distance(q, c.xy));
  return piv + rot(q - piv - m.yz * w, -m.x * w);
}

// Squash the eye vertically (blink) without moving the lid line.
float eye(float2 q, float4 e) {
  if (e.z <= 0.0) { return q.y; }
  float dx = q.x - e.x;
  float dy = q.y - e.y;
  float wx = 1.0 - smoothstep(e.z * 1.05, e.z * 1.45, abs(dx));
  float H = e.w * 1.5;
  float h = max(e.w * (1.0 - blink), e.w * 0.06);
  float a = abs(dy);
  float m = a;
  if (a < h) { m = a * (e.w / h); }
  else if (a < H) { m = e.w + (a - h) * (H - e.w) / (H - h); }
  return mix(q.y, e.y + sign(dy) * m, wx);
}

half4 main(float2 xy) {
  float2 q = xy / size - shift;
  float2 g = float2(cx, ground);
  q = g + rot(q - g, -bodyRot);
  q = limb(q, l0p, l0c, l0);
  float wt = (1.0 - smoothstep(tC.z * 0.75, tC.z * 1.2, distance(q, tC.xy))) * smoothstep(0.0, tC.z * 0.9, distance(q, tB));
  q = tB + rot(q - tB, -tRot * wt);
  float wh = smoothstep(hb.x - hb.z, hb.x, q.x) * (1.0 - smoothstep(hb.y, hb.y + hb.z, q.x))
           * (1.0 - smoothstep(neck.y - 0.02, neck.y + 0.06, q.y)) * useHead;
  q = neck + rot(q - neck - hOff * wh, -hRot * wh);
  q.y = eye(q, e0);
  q.y = eye(q, e1);
  if (q.y < ground) {
    float m = smoothstep(neck.y - 0.05, neck.y + 0.08, q.y);
    q.y = ground - (ground - q.y) / (1.0 + breath);
    q.x = cx + (q.x - cx) / (1.0 + breath * 0.45 * m);
  }
  q = clamp(q, 0.0, 1.0);
  return image.eval(q * size) * alpha;
}
`;
