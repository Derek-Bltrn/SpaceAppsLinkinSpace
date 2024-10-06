import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { asteroids } from './api.js'; // Importar los datos de los asteroides

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); // Aumentar el "far" para ver objetos lejanos
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Crear la instancia de OrbitControls
var controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 200, 800); // Aumentar el zoom inicial para evitar hacer zoom out demasiado
controls.update();

// Añadir luces
var sunLight = new THREE.PointLight(0xffffff, 2, 5000); // Aumentar el alcance de la luz
sunLight.position.set(0, 0, 0); // Colocar la luz en el centro (el sol)
scene.add(sunLight);

var ambientLight = new THREE.AmbientLight(0x404040, 2); // Aumentar la intensidad de la luz ambiental
scene.add(ambientLight);

const textureLoader = new THREE.TextureLoader();
const sunTexture = textureLoader.load('/textures/sun.jpg'); // Asegúrate de que la ruta sea correcta



// Crear el Sol
function createSun() {
    var sunGeometry = new THREE.SphereGeometry(10, 32, 32); // Tamaño del Sol
    var sunMaterial = new THREE.MeshBasicMaterial({ 
      map: sunTexture
  }); // Color amarillo para el Sol
    var sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(0, 0, 0);
    scene.add(sun);
}
var asteroidMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

// Material para los planetas


// Datos de los diámetros reales (en km)
var planetSizes = {
  Mercury: 4880,
  Venus: 12104,
  Earth: 12742,
  Mars: 6779,
  Jupiter: 139820,
  Saturn: 116460,
  Uranus: 50724,
  Neptune: 49244
};
// Función para crear un fondo de estrellas
function createStarfield(numStars) {
    const starsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numStars * 3); // 3 coordenadas por estrella (x, y, z)

    for (let i = 0; i < numStars; i++) {
        const x = (Math.random() - 0.5) * 8000; // Ajusta el rango según tus necesidades
        const y = (Math.random() - 0.5) * 8000;
        const z = (Math.random() - 0.5) * 8000;
        
        positions.set([x, y, z], i * 3);
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);

    return stars;
}

// Crear el fondo de estrellas y agregarlo a la escena
const starfield = createStarfield(10000); // Cambia el número para más o menos estrellas
scene.add(starfield);

// Factores de escala
var distanceScale = 100; // Escala para las distancias orbitales
var sizeScale = 0.001;  // Escala para los tamaños de los planetas
var asteroidScale = .1  


// Orbital Elements: a (semi-major axis), e (eccentricity), I (inclination),
// L (mean longitude), long.peri. (longitude of perihelion), long.node. (longitude of ascending node)
var orbitalElements = [
  { name: "Mercury", a: 0.38709843, e: 0.20563661, i: 7.00559432, long_peri: 77.45771895, long_node: 48.33961819, period: 87.97, texture:"./textures/mercury.jpg" },
  { name: "Venus", a: 0.72332102, e: 0.00676399, i: 3.39777545, long_peri: 131.76755713, long_node: 76.67261496, period: 224.70, texture:"./textures/venus.jpg" },
  { name: "Earth", a: 1.00000018, e: 0.01673163, i: -0.00054346, long_peri: 102.93005885, long_node: -5.11260389, period: 365.25, texture:"./textures/earth.jpg" },
  { name: "Mars", a: 1.52371243, e: 0.09336511, i: 1.85181869, long_peri: -23.91744784, long_node: 49.71320984, period: 686.98, texture:"./textures/mars.jpg" },
  { name: "Jupiter", a: 5.20248019, e: 0.04853590, i: 1.29861416, long_peri: 14.27495244, long_node: 100.29282654, period: 4332.59, texture:"./textures/jupiter.jpg" },
  { name: "Saturn", a: 9.54149883, e: 0.05550825, i: 2.49424102, long_peri: 92.86136063, long_node: 113.63998702, period: 10759.22, texture:"./textures/saturn.jpg" },
  { name: "Uranus", a: 19.18797948, e: 0.04685740, i: 0.77298127, long_peri: 172.43404441, long_node: 73.96250215, period: 30688.5, texture:"./textures/uranus.jpg" },
  { name: "Neptune", a: 30.06952752, e: 0.00895439, i: 1.77005520, long_peri: 46.68158724, long_node: 131.78635853, period: 60182, texture:"./textures/neptune.jpg" }
];

// Conversión de grados a radianes
function toRadians(deg) {
  return deg * Math.PI / 180;
}

// Constructor de trayectorias
function Trajectory(orbitalElements) {
  this.name = orbitalElements.name;
  this.smA = orbitalElements.a;
  this.eccentricity = orbitalElements.e;
  this.inclination = toRadians(orbitalElements.i);
  this.argumentOfPerigee = toRadians(orbitalElements.long_peri);
  this.longitudeOfAscendingNode = toRadians(orbitalElements.long_node);
  this.period = orbitalElements.period;
  this.trueAnomaly = 0; // Inicializar la anomalía verdadera
  this.position = [0, 0, 0];
  this.time = 0;
  this.texture=orbitalElements.texture;
}

// Función para propagar la órbita
Trajectory.prototype.propagate = function (trueAnomaly) {
  var r = (this.smA * (1 - this.eccentricity ** 2)) / (1 + this.eccentricity * Math.cos(trueAnomaly));
  var x = r * (Math.cos(this.argumentOfPerigee + trueAnomaly) * Math.cos(this.longitudeOfAscendingNode) -
               Math.sin(this.argumentOfPerigee + trueAnomaly) * Math.cos(this.inclination) * Math.sin(this.longitudeOfAscendingNode));
  var y = r * (Math.cos(this.argumentOfPerigee + trueAnomaly) * Math.sin(this.longitudeOfAscendingNode) +
               Math.sin(this.argumentOfPerigee + trueAnomaly) * Math.cos(this.inclination) * Math.cos(this.longitudeOfAscendingNode));
  var z = r * (Math.sin(this.argumentOfPerigee + trueAnomaly) * Math.sin(this.inclination));
  return [x * 100, y * 100, z * 100]; // Multiplicar por 100 para hacer más visibles las órbitas
};


function calculatePeriod(meanMotion) {
    return meanMotion > 0 ? 360 / meanMotion : 1; // Asegurarse de que no sea cero o negativo
}

// Añadir asteroides a la escena
function addAsteroids() {
    asteroids.data.forEach((asteroid, index) => { // Añadir índice como segundo parámetro
        const name = asteroid[0] || `Asteroide_${index}`; // Asignar un nombre si no hay
        const eccentricity = parseFloat(asteroid[1]);
        const semiMajorAxis = parseFloat(asteroid[2]);
        const inclination = toRadians(parseFloat(asteroid[3]));
        const longNode = toRadians(parseFloat(asteroid[4]));
        const longPeri = toRadians(parseFloat(asteroid[5]));
        const meanMotion = asteroid[7] !== null ? parseFloat(asteroid[7]) : Math.random() * (1 - 0.1) + 0.1; // Valor aleatorio entre 0.1 y 1
        const diameter = asteroid[8] ? parseFloat(asteroid[8]) : 2;

        // Crear geometría y mesh del asteroide
        var asteroidGeometry = new THREE.SphereGeometry(diameter * asteroidScale, 32, 32);
        var asteroidMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

        // Calcular el periodo y almacenar la anomalía verdadera
        var period = calculatePeriod(meanMotion);
        asteroidMesh.period = period;
        asteroidMesh.trueAnomaly = 0;

        // Calcular la posición inicial
        var r = (semiMajorAxis * (1 - eccentricity ** 2)) / (1 + eccentricity * Math.cos(asteroidMesh.trueAnomaly));
        var x = r * (Math.cos(longPeri + asteroidMesh.trueAnomaly) * Math.cos(longNode) -
                     Math.sin(longPeri + asteroidMesh.trueAnomaly) * Math.cos(inclination) * Math.sin(longNode));
        var y = r * (Math.cos(longPeri + asteroidMesh.trueAnomaly) * Math.sin(longNode) +
                     Math.sin(longPeri + asteroidMesh.trueAnomaly) * Math.cos(inclination) * Math.cos(longNode));
        var z = r * (Math.sin(longPeri + asteroidMesh.trueAnomaly) * Math.sin(inclination));

        asteroidMesh.position.set(x * 100, y * 100, z * 100);
        asteroidMesh.name = name; // Asignar nombre al asteroide

        // Almacenar datos orbitales
        asteroidMesh.eccentricity = eccentricity;
        asteroidMesh.semiMajorAxis = semiMajorAxis;
        asteroidMesh.inclination = inclination;
        asteroidMesh.longNode = longNode;
        asteroidMesh.longPeri = longPeri;

        scene.add(asteroidMesh);
    });
}


// Crear objetos de trayectorias
var heavenlyBodies = [];
orbitalElements.forEach(planet => {
  heavenlyBodies.push(new Trajectory(planet));
});
// Añadir órbitas a la escena
function traceOrbits() {
    var colors = [
        0xCCCCFF, // Mercury
        0xFFCCCC, // Venus
        0xCCFFCC, // Earth
        0xFFCC99, // Mars
        0xFFFF99, // Jupiter
        0x99CCFF, // Saturn
        0xFF99CC, // Uranus
        0xCCCCFF  // Neptune
    ];

    heavenlyBodies.forEach((body, index) => {
        var geometry = new THREE.BufferGeometry();
        var positions = [];
        const step = 0.01; // Pasos más pequeños para una línea más suave

        // Recorrer de 0 a 2π para crear la elipse completa
        for (var i = 0; i <= 2 * Math.PI; i += step) {
            var pos = body.propagate(i);
            positions.push(pos[0], pos[1], pos[2]);
        }
        // Cerrar la elipse
        var firstPos = body.propagate(0);
        positions.push(firstPos[0], firstPos[1], firstPos[2]);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        var material = new THREE.LineBasicMaterial({ color: colors[index] }); // Usar el color correspondiente
        var line = new THREE.Line(geometry, material);
        scene.add(line);
    });
}


// Añadir planetas a la escenafunction addPlanets() {
// Añadir planetas a la escena
function addPlanets() {
    heavenlyBodies.forEach(body => {
      // Obtener el tamaño del planeta y aplicarle la escala
      var planetDiameter = planetSizes[body.name] * sizeScale;
      const planetTexture = textureLoader.load(body.texture); 
      // Geometría del planeta (usando el diámetro a escala)
      var planetGeometry = new THREE.SphereGeometry(planetDiameter / 2, 32, 32); // Radio = diámetro/2
  
      var planetMaterial = new THREE.MeshBasicMaterial({
        map: planetTexture, // Cargar la textura del planeta
      });
      var planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
  
      // Corregir la orientación de la textura
      planetMesh.rotation.x = Math.PI / 2; // Rotar 90 grados en el eje Y
  
      // Posición inicial del planeta
      var initialPos = body.propagate(body.trueAnomaly);
      planetMesh.position.set(initialPos[0], initialPos[1], initialPos[2]);
      planetMesh.name = body.name;
      scene.add(planetMesh);
    });
  }  


// Animación para actualizar las posiciones de los planetas
function animate() {
    requestAnimationFrame(animate);

    // Actualizar posiciones de los planetas
    heavenlyBodies.forEach(body => {
        var planet = scene.getObjectByName(body.name);
        var newPos = body.propagate(body.trueAnomaly);
        planet.position.set(newPos[0], newPos[1], newPos[2]);

        // Incrementar la anomalía verdadera para animar la órbita
        body.trueAnomaly += (2 * Math.PI / body.period) * 0.1; // Ajustar la velocidad según el periodo
        if (body.trueAnomaly > 2 * Math.PI) {
            body.trueAnomaly -= 2 * Math.PI;
        }
    });
// Función para manejar clics en los planetas
function onDocumentMouseDown(event) {
    event.preventDefault();

    // Calcular la posición del mouse en el espacio de la pantalla
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Crear un rayo a partir de la cámara y la posición del mouse
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Calcular objetos intersectados
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const planet = intersects[0].object;
        
        // Si el objeto es un planeta, hacer zoom y seguirlo
        if (planet.name) {
            const targetPosition = planet.position.clone();
            zoomToPlanet(targetPosition, planet);
        }
    }
}

// Función para hacer zoom en un planeta
function zoomToPlanet(targetPosition, planet) {
  console.log(planet);
    // Ajustar la posición de la cámara para hacer zoom en el planeta
    const zoomFactor = 3; // Factor de zoom
    const offset = new THREE.Vector3(0, 0, 1).normalize().multiplyScalar(200); // Offset para alejar un poco la cámara
    camera.position.copy(targetPosition).add(offset);
    const planetInfoDiv = document.getElementById('planet-info');
    const planetName = document.getElementById('planet-name');
    const planetParams = document.getElementById('planet-params');
    // Configurar controls para seguir el planeta
    controls.target.copy(targetPosition);
    
    // Animar la cámara hacia la posición del planeta
    const duration = 1000; // Duración de la animación en milisegundos
    const startPosition = camera.position.clone();
    const startTime = performance.now();
    planetName.innerText = planet.name; // Asume que cada planeta tiene una propiedad "name"
    planetParams.innerText = `
        Eccentricity: ${'.0933934'}
        semi-major axis: ${'1.52371034'}
        Inclination: ${'1.84969142'}
        perihelion longitude: ${'-23.94362959'}
        longitude of ascending node: ${'49.55953891'}
    `;
    planetInfoDiv.style.display = 'block';
    function animateZoom() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Interpolación lineal para el movimiento
        camera.position.lerpVectors(startPosition, targetPosition.clone().add(offset), progress);
        
        if (progress < 1) {
            requestAnimationFrame(animateZoom);
        }
    }
    
    animateZoom();
}
// Variable para almacenar la posición original de la cámara
const originalCameraPosition = camera.position.clone();
const originalCameraTarget = controls.target.clone();
let backButton;

// Función para crear el botón de regreso
function createBackButton() {
    backButton = document.createElement('button');
    backButton.innerText = 'Regresar';
    backButton.style.position = 'absolute';
    backButton.style.top = '20px';
    backButton.style.left = '20px';
    backButton.style.zIndex = '10';
    document.body.appendChild(backButton);

    backButton.addEventListener('click', () => {
        zoomOutFromPlanet();
    });
}

// Función para hacer zoom fuera del planeta
function zoomOutFromPlanet() {
    // Restablecer la posición de la cámara a la original
    const zoomFactor = 3; // Factor de zoom
    const offset = new THREE.Vector3(0, 0, 1).normalize().multiplyScalar(200);
    
    // Animar la cámara hacia la posición original
    const duration = 1000; // Duración de la animación en milisegundos
    const startPosition = camera.position.clone();
    const startTime = performance.now();

    function animateZoomOut() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Interpolación lineal para el movimiento
        camera.position.lerpVectors(startPosition, originalCameraPosition.clone().add(offset), progress);
        
        if (progress < 1) {
            requestAnimationFrame(animateZoomOut);
        } else {
            // Después de completar el zoom, eliminar el botón
            document.body.removeChild(backButton);
            backButton = null;
        }
    }

    animateZoomOut();
}

// Modificar la función de clic en planetas para mostrar el botón
function onDocumentMouseDown(event) {
    event.preventDefault();

    // Calcular la posición del mouse en el espacio de la pantalla
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Crear un rayo a partir de la cámara y la posición del mouse
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Calcular objetos intersectados
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const planet = intersects[0].object;
        
        // Si el objeto es un planeta, hacer zoom y seguirlo
        if (planet.name) {
            const targetPosition = planet.position.clone();
            zoomToPlanet(targetPosition, planet);
            createBackButton(); // Crear el botón de regreso
        }
    }
}
// Agregar el evento de clic al documento
window.addEventListener('mousedown', onDocumentMouseDown, false);

    // Actualizar posiciones de los asteroides
    scene.children.forEach(obj => {
        if (obj.name && obj.name !== 'Sun' && obj.period) { // Identificar solo los asteroides
            var r = (obj.semiMajorAxis * (1 - obj.eccentricity ** 2)) / (1 + obj.eccentricity * Math.cos(obj.trueAnomaly));
            var x = r * (Math.cos(obj.longPeri + obj.trueAnomaly) * Math.cos(obj.longNode) -
                         Math.sin(obj.longPeri + obj.trueAnomaly) * Math.cos(obj.inclination) * Math.sin(obj.longNode));
            var y = r * (Math.cos(obj.longPeri + obj.trueAnomaly) * Math.sin(obj.longNode) +
                         Math.sin(obj.longPeri + obj.trueAnomaly) * Math.cos(obj.inclination) * Math.cos(obj.longNode));
            var z = r * (Math.sin(obj.longPeri + obj.trueAnomaly) * Math.sin(obj.inclination));

            obj.position.set(x * 100, y * 100, z * 100);

            // Incrementar la anomalía verdadera para animar la órbita del asteroide
            obj.trueAnomaly += (2 * Math.PI / obj.period) * 0.1; // Ajustar la velocidad según el periodo
            if (obj.trueAnomaly > 2 * Math.PI) {
                obj.trueAnomaly -= 2 * Math.PI;
            }

            // Log de depuración
            
        }
    });
    controls.update();
    renderer.render(scene, camera);
}
// Llamadas a las funciones
createSun();  // Añadir el sol
addAsteroids();
traceOrbits(); // Añadir las órbitas primero
addPlanets();  // Después añadir los planetas
animate();
