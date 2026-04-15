precision highp float;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vNoise;

void main() {
  vec3 viewDir = normalize(vec3(0.0, 0.0, 4.2) - vPosition);
  
  // Adjusted fresnel to be softer and more widespread for a glowing core
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.2);

  // Mix between Color A, B, and C
  vec3 color = mix(uColorA, uColorB, vNoise * 0.5 + 0.5); // shift noise to 0..1 roughly
  color = mix(color, uColorC, fresnel * 0.8);

  // Add the soft white core glow ("soft bloom glow")
  // Instead of harsh specular, we fade in some white towards the center of the blob
  float coreIntensity = pow(max(dot(vNormal, viewDir), 0.0), 2.0);
  color = mix(color, vec3(1.0), coreIntensity * 0.15); // soft center

  // Enhanced rim lighting for high-end look
  color += uColorC * fresnel * 1.5;
  color += uColorA * pow(fresnel, 4.0) * 1.5;

  // Wet specular reflection (sharp highlight from the top-ish)
  vec3 lightDir = normalize(vec3(0.8, 1.4, 1.0));
  float specular = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 32.0);
  
  color += specular * 0.9 * vec3(1.0, 0.95, 0.9);

  gl_FragColor = vec4(color, 1.0);
}