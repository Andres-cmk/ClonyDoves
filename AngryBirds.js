const { Bodies, Engine, World, Events, Body,
  Mouse, MouseConstraint, Constraint } = Matter;

//matters
let engine, world;

// Espacio lógico del juego: toda la física y el nivel viven en esta
// resolución fija. El canvas real se amplía a toda la ventana y el
// contenido se escala/centra dentro de ella (ver computeViewport()),
// así el nivel no se recalcula ni se deforma al cambiar el tamaño.
const GAME_WIDTH = 800;
const GAME_HEIGHT = 560;
// Escala X/Y independiente: el espacio lógico se estira para cubrir el
// 100% del ancho y alto reales de la ventana (sin franjas/letterbox),
// así el suelo, los muros y la resortera quedan siempre en el borde
// real de la pantalla y los rebotes ocurren justo ahí.
let viewScaleX = 1;
let viewScaleY = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;

function computeViewport() {
  viewScaleX = windowWidth / GAME_WIDTH;
  viewScaleY = windowHeight / GAME_HEIGHT;
  viewOffsetX = 0;
  viewOffsetY = 0;
}


// worlds
let ground;
let bgImg;
// Coordenada Y de la superficie del suelo (espacio lógico), usada por
// Slingshot.js para que las patas de la resortera lleguen hasta el piso
let groundY;

// structure
let boxes = [];
let boxStates = [];
let woodStates = [];


// pigs
let pigs = [];
let pigStates = [];
let pigSounds = [];
let pigDeathSound;

// birds
let birdLaunched = false;
let launchTime;
const TIME_TO_WAIT = 5000; 
let birdImages = []
let birdQueue = [];
const TOTAL_BIRDS = 4;


// Slingshot
let slingshot;
let imgSlingshot;
let audioStreched;

// Mouse de Matter.js, guardado para poder re-mapear sus coordenadas
// cuando la ventana cambia de tamaño (ver windowResized())
let mouse;
let mc;

// Lifetime: límites del área jugable, usados para limpiar objetos/cerdos
// que quedan fuera de límites (ver Box.checkLifetime / Pig.checkLifetime)
let playBounds;

// Explosion
let explosions = [];
let explosionImg;

// Menú inicial: el juego arranca en "menu" y pasa a "playing" al
// presionar el botón. La física ya está armada desde setup(), pero no
// se actualiza (Engine.update) ni se dibuja hasta empezar a jugar.
let gameState = "menu";
let startButton = { x: 0, y: 0, w: 0, h: 0 };
let pauseButton = { x: 0, y: 0, w: 0, h: 0 };
let resumeButton = { x: 0, y: 0, w: 0, h: 0 };
let retryButton = { x: 0, y: 0, w: 0, h: 0 };
let menuButton = { x: 0, y: 0, w: 0, h: 0 };


function preload(){
    bgImg = loadImage("./images/background.jpg");
    
    // Cargar los 4 estados de la caja
    boxStates = [
      loadImage("./images/box1.png"),
      loadImage("./images/box2.png"),
      loadImage("./images/box3.png"),
      loadImage("./images/box4.png")
    ];
    
    // Cargar los 4 estados de la madera
    woodStates = [
      loadImage("./images/wood1.png"),
      loadImage("./images/wood2.png"),
      loadImage("./images/wood3.png"),
      loadImage("./images/wood4.png")
    ];
    
    pigStates = [
    loadImage("./images/pig.png"),
    loadImage("./images/pig2.png"),
    loadImage("./images/pig3.png")
    ];
    imgSlingshot = loadImage("./images/Slingshot_Classic.png");
    audioStreched = createAudio("./audios/slingshot_streched.wav");
    birdImages = [
    loadImage("./images/red.png"),
    loadImage("./images/chuck.png"),
    loadImage("./images/bomb.png")
    ];
    explosionImg = loadImage("./images/explosion.gif");
    pigSounds.push(createAudio("./audios/pig1.wav"));
    pigSounds.push(createAudio("./audios/pig2.wav"));
    pigDeathSound = createAudio("./audios/pigDeath.wav");
}


function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  computeViewport();

  engine = Engine.create();
  world = engine.world;

  mouse = Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  // El canvas real es del tamaño de la ventana, pero la física vive en
  // el espacio lógico GAME_WIDTH x GAME_HEIGHT. Corregimos las
  // coordenadas del mouse de Matter.js para que coincidan con ese
  // espacio lógico (soporte nativo de Matter para canvases escalados).
  Mouse.setScale(mouse, { x: 1 / viewScaleX, y: 1 / viewScaleY });
  Mouse.setOffset(mouse, { x: -viewOffsetX / viewScaleX, y: -viewOffsetY / viewScaleY });

  mc = MouseConstraint.create(engine, {
    mouse: mouse,
    collisionFilter: {
      mask: 0xFFFF
    }
  });

  World.add(world, mc);

  buildLevel();

  Events.on(engine, "afterUpdate", () => {
    if (!isAnimatingBird && bird) {
      slingshot.fly(mc);
    }

    // Añadimos !isAnimatingBird para evitar que el pájaro sea marcado como "lanzado"
    // mientras solo está caminando hacia la resortera. Esto causaba que se borrara al llegar.
    if (!isAnimatingBird && birdLaunched === false && bird && !slingshot.hasBird()) {
      
      // Sacamos de la cola AL LANZAR para que las demás aves avancen en la pantalla
      if (birdQueue.includes(bird)) {
        let index = birdQueue.indexOf(bird);
        birdQueue.splice(index, 1);
      }

      birdLaunched = true;
      launchTime = millis();
    }
  });

  Events.on(engine, 'collisionStart', (event) => {
  for (let pair of event.pairs) {
    const { bodyA, bodyB } = pair;

    // Pasamos la velocidad del otro objeto para un cálculo de daño cruzado
    checkAndDamagePig(bodyA, bodyB.speed);
    checkAndDamagePig(bodyB, bodyA.speed);
    
    // Lo mismo para las cajas
    checkAndDamageBox(bodyA, bodyB.speed);
    checkAndDamageBox(bodyB, bodyA.speed);
  }
});
}

// Arma el nivel (suelo, muros, pirámide de cajas, cola de aves, cerdos y
// resortera). Se llama una vez desde setup() y de nuevo desde
// resetLevel() al reintentar, así que no debe registrar listeners del
// engine (esos ya están puestos una sola vez en setup() y leen las
// variables globales de nuevo cada vez que se disparan).
function buildLevel() {
  playBounds = { left: 0, top: 0, right: GAME_WIDTH, bottom: GAME_HEIGHT };

  ground = new Ground(GAME_WIDTH/2, GAME_HEIGHT-10, GAME_WIDTH, 20);

  // Muros invisibles para evitar que los cerdos (y aves) salgan del recuadro
  let leftWall = new Ground(-10, GAME_HEIGHT/2, 20, GAME_HEIGHT*2);
  let rightWall = new Ground(GAME_WIDTH + 10, GAME_HEIGHT/2, 20, GAME_HEIGHT*2);
  let ceiling = new Ground(GAME_WIDTH/2, -50, GAME_WIDTH*2, 100);

  // --- CONSTRUCCIÓN DEL NIVEL ---
  let startX = 650;
  groundY = GAME_HEIGHT - 20;

  // Nivel 1: Base (Dos pilares verticales y un techo largo)
  boxes.push(new Box(startX - 50, groundY - 50, 55, 55, boxStates));
  boxes.push(new Box(startX + 50, groundY - 50, 55, 55, boxStates));
  boxes.push(new Box(startX + 50, groundY - 95, 55, 55, boxStates));
  boxes.push(new Box(startX - 50, groundY - 95, 55, 55, boxStates));
  // Techo/Viga larga
  boxes.push(new Box(startX, groundY - 110, 160, 20, woodStates));

  // Nivel 2: Intermedio
  boxes.push(new Box(startX - 40, groundY - 160, 55, 55, boxStates));
  boxes.push(new Box(startX + 40, groundY - 160, 55, 55, boxStates));
  boxes.push(new Box(startX, groundY - 210, 140, 20, woodStates));

  // Nivel 3: Cúspide
  boxes.push(new Box(startX, groundY - 240, 40, 40, boxStates));

  for (let i = 0; i < TOTAL_BIRDS; i++) {
    let xPos = 120 - (i * 60);
    let yPos = GAME_HEIGHT - 55;

    let img = birdImages[i % birdImages.length];
    let b = new Bird(xPos, yPos, 25, img);

    if (i > 0) {
      Matter.Body.setStatic(b.body, true);
    }
    birdQueue.push(b);
  }

  bird = birdQueue[0];
  Matter.Body.setPosition(bird.body, { x: targetPos.x, y: targetPos.y });
  Matter.Body.setStatic(bird.body, false);

  slingshot = new Slingshot(bird, imgSlingshot, audioStreched);

  // Cerdito dentro de la base
  let pig1 = new Pig(startX, groundY - 40, 25, pigStates);
  pigs.push(pig1);

  // Cerdito en el segundo piso
  let pig2 = new Pig(startX, groundY - 145, 25, pigStates);
  pigs.push(pig2);
}

// Reinicia la partida: limpia todo el mundo físico (incluyendo cuerpos
// estáticos, por eso se vuelve a agregar el mouse constraint) y vuelve
// a armar el nivel desde cero. No recrea el engine ni los listeners de
// eventos, que siguen leyendo las variables globales reasignadas acá.
function resetLevel() {
  World.clear(world, false);
  World.add(world, mc);

  boxes = [];
  pigs = [];
  birdQueue = [];
  explosions = [];
  bird = null;
  birdLaunched = false;
  isAnimatingBird = false;

  buildLevel();
}

// El canvas cambia de tamaño con la ventana; la física (GAME_WIDTH x
// GAME_HEIGHT) no se toca, solo se recalcula cómo se ve/mapea el mouse.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeViewport();

  if (mouse) {
    Mouse.setScale(mouse, { x: 1 / viewScaleX, y: 1 / viewScaleY });
    Mouse.setOffset(mouse, { x: -viewOffsetX / viewScaleX, y: -viewOffsetY / viewScaleY });
  }
}


function draw() {
  if (gameState === "menu") {
    drawMenu();
    return;
  }

  // Fondo a pantalla completa (sin bordes), fuera del espacio lógico escalado
  background(128);
  image(bgImg, 0, 0, width, height);

  // La física (y todo lo que dependa de millis()/animaciones) solo
  // avanza mientras se está jugando; en pausa o en la pantalla de fin
  // de ronda se sigue dibujando la última escena, pero congelada.
  const isPlaying = gameState === "playing";

  if (isPlaying) {
    Engine.update(engine);
  }

  push();
  translate(viewOffsetX, viewOffsetY);
  scale(viewScaleX, viewScaleY);

  ground.show();

  if (isPlaying && birdLaunched && bird) {
    let currentTime = millis();
    let speed = bird.body.speed;

    if (currentTime - launchTime > TIME_TO_WAIT || (speed < 0.2 && currentTime - launchTime > 1000)) {
      World.remove(world, bird.body);
      bird = null;
      birdLaunched = false;

      // YA NO HACEMOS SHIFT AQUÍ. El siguiente pájaro ya es el índice 0.
      if (birdQueue.length > 0) {
        bird = birdQueue[0];
        isAnimatingBird = true;
        Matter.Body.setStatic(bird.body, true);
      }
    }
  }

  // Se acabaron las aves: no hay una activa ni quedan en cola
  if (isPlaying && bird === null && birdQueue.length === 0) {
    gameState = "roundOver";
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    let box = boxes[i];
    if (isPlaying) box.checkLifetime(playBounds);
    box.show();

    if (box.isDead) {
      // Opcional: añadir una pequeña explosión o efecto de polvo aquí
      // explosions.push(new Explosion(box.body.position.x, box.body.position.y, explosionImg));
      World.remove(world, box.body);
      boxes.splice(i, 1);
    }
  }

  for (let i = 0; i < birdQueue.length; i++) {
    let b = birdQueue[i];

    if (b === bird) {
      continue;
    }

    if (isPlaying) {
      let targetX = 120 - (i * 60);
      let targetY = GAME_HEIGHT - 55;

      let currentPos = b.body.position;
      let nextX = lerp(currentPos.x, targetX, 0.1);
      let nextY = lerp(currentPos.y, targetY, 0.1);

      Matter.Body.setPosition(b.body, { x: nextX, y: nextY });
    }

    b.show();
  }

  if (bird) {
    bird.show();
  }

  if (isPlaying && isAnimatingBird && bird) {
    let pos = bird.body.position;
    let newX = lerp(pos.x, targetPos.x, 0.1);
    let newY = lerp(pos.y, targetPos.y, 0.1);

    Matter.Body.setPosition(bird.body, { x: newX, y: newY });

    if (dist(newX, newY, targetPos.x, targetPos.y) < 2) {
      isAnimatingBird = false;
      Matter.Body.setStatic(bird.body, false);
      slingshot.attach(bird);
    }
  }

  for (let i = pigs.length - 1; i >= 0; i--) {
    if (isPlaying) pigs[i].checkLifetime(playBounds);
    pigs[i].show();
    if (pigs[i].isDead) {
      let pPos = pigs[i].body.position;
      explosions.push(new Explosion(pPos.x, pPos.y, explosionImg));
      World.remove(world, pigs[i].body);
      pigs.splice(i, 1);
    }
  }

  // El timer de la explosión avanza dentro de su propio show(), así que
  // solo se actualiza mientras se está jugando (si no, "consumiría" su
  // animación de golpe en cuanto se reanude la partida)
  if (isPlaying) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].show();
      if (explosions[i].isFinished()) {
        explosions.splice(i, 1);
      }
    }
  }

  slingshot.show();

  pop();

  if (gameState === "playing") {
    drawPauseButton();
  } else if (gameState === "paused") {
    drawPauseOverlay();
  } else if (gameState === "roundOver") {
    drawRoundOverOverlay();
  }
}

let isAnimatingBird = false;
let targetPos = { x: 150, y: 400 };

// Menú de inicio, dibujado en coordenadas reales de pantalla (no en el
// espacio lógico escalado) para que el botón sea fácil de posicionar
// y de detectar con mouseX/mouseY tal cual los da p5.
function drawMenu() {
  background(20);
  image(bgImg, 0, 0, width, height);

  push();
  noStroke();
  fill(0, 0, 0, 130);
  rect(0, 0, width, height);
  pop();

  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill(255);
  stroke(60, 30, 10);
  strokeWeight(4);
  textSize(min(width, height) * 0.09);
  text("Angry Birds - ClonyDoves", width / 2, height * 0.3);
  pop();

  startButton.w = min(width, height) * 0.28;
  startButton.h = startButton.w * 0.32;
  startButton.x = width / 2 - startButton.w / 2;
  startButton.y = height * 0.55;

  const hovering =
    mouseX > startButton.x && mouseX < startButton.x + startButton.w &&
    mouseY > startButton.y && mouseY < startButton.y + startButton.h;

  push();
  strokeWeight(3);
  stroke(60, 30, 10);
  fill(hovering ? color(255, 190, 60) : color(230, 160, 40));
  rectMode(CORNER);
  rect(startButton.x, startButton.y, startButton.w, startButton.h, 14);
  noStroke();
  fill(60, 30, 10);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(startButton.h * 0.4);
  text("Iniciar Juego", width / 2, startButton.y + startButton.h / 2);
  pop();

  push();
  noStroke();
  fill(255);
  textStyle(NORMAL);
  textAlign(CENTER, CENTER);
  textSize(min(width, height) * 0.022);
  text(
    "Arrastrá el ave hacia atrás y soltá para lanzarla",
    width / 2,
    startButton.y + startButton.h + min(width, height) * 0.05
  );
  pop();
}

// --- Helpers de UI reutilizables para los botones de pausa/reintentar/menú ---
// (el menú de inicio no los usa: su botón ya funcionaba antes de esto y
// no hacía falta tocarlo para agregar las pantallas nuevas)

function isMouseOver(btn) {
  return mouseX > btn.x && mouseX < btn.x + btn.w &&
         mouseY > btn.y && mouseY < btn.y + btn.h;
}

function layoutButton(btn, cx, cy, w, h) {
  btn.w = w;
  btn.h = h;
  btn.x = cx - w / 2;
  btn.y = cy - h / 2;
}

function drawButton(btn, label) {
  const hovering = isMouseOver(btn);

  push();
  strokeWeight(3);
  stroke(60, 30, 10);
  fill(hovering ? color(255, 190, 60) : color(230, 160, 40));
  rectMode(CORNER);
  rect(btn.x, btn.y, btn.w, btn.h, 14);
  noStroke();
  fill(60, 30, 10);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(btn.h * 0.4);
  text(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  pop();
}

// Botón de pausa (ícono "II"), visible en la esquina mientras se juega
function drawPauseButton() {
  const size = min(width, height) * 0.09;
  pauseButton.w = size;
  pauseButton.h = size;
  pauseButton.x = width - size - 20;
  pauseButton.y = 20;

  const hovering = isMouseOver(pauseButton);

  push();
  strokeWeight(3);
  stroke(60, 30, 10);
  fill(hovering ? color(255, 190, 60) : color(230, 160, 40, 220));
  rect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 10);

  noStroke();
  fill(60, 30, 10);
  rectMode(CENTER);
  const barW = pauseButton.w * 0.16;
  const barH = pauseButton.h * 0.5;
  const cy = pauseButton.y + pauseButton.h / 2;
  rect(pauseButton.x + pauseButton.w * 0.38, cy, barW, barH, 2);
  rect(pauseButton.x + pauseButton.w * 0.62, cy, barW, barH, 2);
  rectMode(CORNER);
  pop();
}

// Panel compartido: fondo oscurecido + título + una columna de botones.
// Usado tanto por la pantalla de pausa como por la de fin de ronda.
function drawOverlayPanel(title, buttons) {
  push();
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  pop();

  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill(255);
  stroke(60, 30, 10);
  strokeWeight(4);
  textSize(min(width, height) * 0.07);
  text(title, width / 2, height * 0.28);
  pop();

  const btnW = min(width, height) * 0.26;
  const btnH = btnW * 0.3;
  const gap = btnH * 0.5;
  const totalH = buttons.length * btnH + (buttons.length - 1) * gap;
  const firstCy = height / 2 - totalH / 2 + btnH / 2;

  buttons.forEach((b, i) => {
    layoutButton(b.rect, width / 2, firstCy + i * (btnH + gap), btnW, btnH);
    drawButton(b.rect, b.label);
  });
}

function drawPauseOverlay() {
  drawOverlayPanel("Pausa", [
    { rect: resumeButton, label: "Continuar" },
    { rect: retryButton, label: "Reintentar" },
    { rect: menuButton, label: "Menú Principal" },
  ]);
}

function drawRoundOverOverlay() {
  drawOverlayPanel("¡Sin aves!", [
    { rect: retryButton, label: "Reintentar" },
    { rect: menuButton, label: "Menú Principal" },
  ]);
}

function mousePressed() {
  if (gameState === "menu") {
    if (isMouseOver(startButton)) {
      gameState = "playing";
    }
    return;
  }

  if (gameState === "playing") {
    if (isMouseOver(pauseButton)) {
      gameState = "paused";
    }
    return;
  }

  if (gameState === "paused") {
    if (isMouseOver(resumeButton)) {
      gameState = "playing";
    } else if (isMouseOver(retryButton)) {
      resetLevel();
      gameState = "playing";
    } else if (isMouseOver(menuButton)) {
      resetLevel();
      gameState = "menu";
    }
    return;
  }

  if (gameState === "roundOver") {
    if (isMouseOver(retryButton)) {
      resetLevel();
      gameState = "playing";
    } else if (isMouseOver(menuButton)) {
      resetLevel();
      gameState = "menu";
    }
    return;
  }
}

function keyPressed() {
  if (gameState !== "playing") return;

  if (key === " " && !slingshot.hasBird()) {
    if (!bird && birdQueue.length > 0) {
      bird = birdQueue[0];
      isAnimatingBird = true;
    }
  }
}

function checkAndDamagePig(body, impactSpeed) {
  const pigFound = pigs.find(p => p.body === body);
  
  if (pigFound) {
    let speed = impactSpeed || body.speed;
    if (speed > 3) {
      pigFound.hit(speed * 8, pigSounds, pigDeathSound); 
    }
  }
}

function checkAndDamageBox(body, impactSpeed) {
  const boxFound = boxes.find(b => b.body === body);
  
  if (boxFound) {
    let speed = impactSpeed || body.speed;
    // Solo aplicamos daño si la velocidad del impacto es considerable
    // para evitar que se rompan por simplemente acomodarse por la gravedad
    if (speed > 5) { 
      boxFound.hit(speed * 5); // Multiplicador de daño para la madera
    }
  }
}
