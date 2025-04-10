import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Chart from 'chart.js/auto';
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
// import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';


// ==== 1. Globe Setup ====
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('globe'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const globeTexture = new THREE.TextureLoader().load('/earth.jpg');
const globeMaterial = new THREE.MeshBasicMaterial({ map: globeTexture });
const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), globeMaterial);
scene.add(globe);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// const composer = new EffectComposer(renderer);
// composer.addPass(new RenderPass(scene, camera));
// composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0, 0.1));

// Track points and light beams
const points = [];
const lightBeams = [];

function latLonToXYZ(lat, lon, radius = 1.01) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function addPoint(lat, lon, suspicious) {
  const color = suspicious ? 0xff0000 : 0x00ffff;
  const geometry = new THREE.SphereGeometry(0.01, 6, 6);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  const point = new THREE.Mesh(geometry, material);
  const pos = latLonToXYZ(lat, lon);

  point.position.copy(pos);
  scene.add(point);
  points.push({ mesh: point, timestamp: Date.now(), suspicious });

  if (suspicious) {
    const beamHeight = 0.2;
    const beamGeometry = new THREE.CylinderGeometry(0.005, 0.005, beamHeight, 8);
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);

    // Beam goes from globe center to surface
    const dir = pos.clone().normalize();
    const beamPos = pos.clone().addScaledVector(dir, beamHeight / 2); // center of the beam
    beam.position.copy(beamPos);

    // Align beam with direction vector
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    scene.add(beam);
    lightBeams.push({ beam, timestamp: Date.now() });
  }
}


function fadePoints() {
  const now = Date.now();
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const age = now - p.timestamp;
    if (age > 10000) {
      scene.remove(p.mesh);
      points.splice(i, 1);
    } else {
      const alpha = Math.max(1 - age / 10000, 0);
      p.mesh.material.opacity = alpha;
    }
  }

  for (let i = lightBeams.length - 1; i >= 0; i--) {
    const beam = lightBeams[i];
    const age = now - beam.timestamp;
    if (age > 10000) {
      scene.remove(beam.beam);
      lightBeams.splice(i, 1);
    } else {
      const alpha = Math.max(1 - age / 10000, 0);
      beam.beam.material.opacity = alpha;
    }
  }
}


// ==== 2. Live Data Polling ====
const recentPackages = [];

async function fetchData() {
  const res = await fetch('http://localhost:5000/api/get_packages');
  const data = await res.json();
  const now = Date.now();

  data.forEach(pkg => {
    addPoint(pkg.latitude, pkg.longitude, pkg.suspicious);
    recordToChart(pkg);
    recentPackages.push({ ...pkg, timestamp: now });
  });

  // Remove old packages
  while (recentPackages.length > 0 && recentPackages[0].timestamp < now - 10000) {
    recentPackages.shift();
  }

  updateTopCountries();
}

function updateTopCountries() {
  const countryCounts = {};
  recentPackages.forEach(pkg => {
    countryCounts[pkg.country] = (countryCounts[pkg.country] || 0) + 1;
  });

  const sorted = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topEl = document.getElementById('top-countries');
  topEl.innerHTML = `<h3>Top Countries (10s)</h3>` + sorted.map(([cc, count]) => `<div>${cc}: ${count}</div>`).join('');
}

setInterval(fetchData, 1000);

// ==== 3. Chart.js Plot ====
const plotCtx = document.getElementById('plot-canvas').getContext('2d');
const trafficChart = new Chart(plotCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Packages / Second',
      data: [],
      borderColor: '#ff77ff',
      backgroundColor: 'rgba(255, 119, 255, 0.2)',
      tension: 0.3
    }]
  },
  options: {
    animation: false,
    responsive: true,
    scales: {
      x: { display: false },
      y: { beginAtZero: true }
    }
  }
});

const chartBuffer = [];

function recordToChart(pkg) {
  const now = Math.floor(Date.now() / 1000);
  chartBuffer.push(now);

  // Keep only timestamps within the last 15 seconds
  const cutoff = now - 15;
  while (chartBuffer.length > 0 && chartBuffer[0] < cutoff) {
    chartBuffer.shift();
  }

  const counts = {};
  chartBuffer.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => a[0] - b[0]);
  trafficChart.data.labels = sorted.map(([ts]) => new Date(ts * 1000).toLocaleTimeString());
  trafficChart.data.datasets[0].data = sorted.map(([_, c]) => c);
  trafficChart.update();
}


// ==== 4. Theme & View Toggles ====
const toggleThemeBtn = document.getElementById('toggle-theme');
const toggleViewBtn = document.getElementById('toggle-view');
let theme = 'dark';

toggleThemeBtn.onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.body.className = theme;
  toggleThemeBtn.innerText = theme === 'dark' ? '🌙' : '🌞';
  toggleThemeBtn.dataset.theme = theme;

  // Background + globe update
  scene.background = new THREE.Color(theme === 'dark' ? '#100a18' : '#6b3f97'); // Cosmic violet in light theme
  globeMaterial.color.set(theme === 'dark' ? '#ffffff' : '#eeeeff');

  // Chart color update
  trafficChart.data.datasets[0].borderColor = theme === 'dark' ? '#ff77ff' : '#7b00ff';
  trafficChart.data.datasets[0].backgroundColor = theme === 'dark'
    ? 'rgba(255,119,255,0.2)' : 'rgba(123,0,255,0.2)';
  trafficChart.update();
};

toggleViewBtn.onclick = () => {
  const globeCanvas = document.getElementById('globe');
  const plotView = document.getElementById('plot-view');
  const isGlobe = globeCanvas.style.display !== 'none';

  globeCanvas.style.display = isGlobe ? 'none' : 'block';
  plotView.style.display = isGlobe ? 'block' : 'none';
  toggleViewBtn.innerText = isGlobe ? '🌍' : '📊';
  toggleViewBtn.dataset.view = isGlobe ? 'plot' : 'globe';
};

// ==== 5. Render Loop ====
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  fadePoints();  // Fade out points over time
  renderer.render(scene, camera);
  // composer.render();

}
animate();

