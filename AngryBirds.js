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
// "bird" es siempre el ave que está caminando hacia la resortera o ya
// enganchada en ella (apuntando); "projectile" es el ave que ya salió
// disparada y todavía está en el aire, rastreada aparte para poder
// eliminarla por tiempo/asentamiento SIN afectar a "bird" -así el
// jugador puede elegir/cambiar la siguiente ave mientras la anterior
// todavía está volando-.
let birdLaunched = false;
let launchTime;
let projectile = null;
const TIME_TO_WAIT = 8000;
const SETTLE_GRACE = 2500; // antes 1000: desaparecía casi al instante de frenarse
let birdImages = []
let birdQueue = [];
const TOTAL_BIRDS = 5; // una de cada tipo: red, chuck, bomb, OldTerence, matilda


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

// Puntaje: suma puntos fijos por cada caja y cada cerdo destruidos
let score = 0;
const POINTS_PER_BOX = 50;
const POINTS_PER_PIG = 200;

// Medallas otorgadas al ganar (todos los cerdos muertos), según el
// puntaje final. Máximo posible en este nivel: 9 cajas*50 + 2 cerdos*200
// = 850, de ahí salen los umbrales.
let medalEasyImg, medalMediumImg, medalHardImg;
const MEDAL_HARD_SCORE = 600;
const MEDAL_MEDIUM_SCORE = 350;

function getMedalForScore(s) {
  if (s >= MEDAL_HARD_SCORE) return medalHardImg;
  if (s >= MEDAL_MEDIUM_SCORE) return medalMediumImg;
  return medalEasyImg;
}

// Menú inicial: el juego arranca en "menu" y pasa a "playing" al
// presionar el botón. La física ya está armada desde setup(), pero no
// se actualiza (Engine.update) ni se dibuja hasta empezar a jugar.
let gameState = "menu";
// "win" (murieron todos los cerdos) o "lose" (se acabaron las aves con
// cerdos vivos todavía) - define qué se muestra en la pantalla de
// fin de ronda.
let roundResult = null;
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
    medalEasyImg = loadImage("./images/medal_easy.png");
    medalMediumImg = loadImage("./images/medal_medium.png");
    medalHardImg = loadImage("./images/medal_hard.png");
    birdImages = [
    loadImage("./images/red.png"),
    loadImage("./images/chuck.png"),
    loadImage("./images/bomb.png"),
    loadImage("./images/OldTerence.png"),
    loadImage("./images/matilda.png")
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

      // El ave recién lanzada pasa a rastrearse como "projectile"
      // (para el timeout/asentamiento), y la siguiente de la cola
      // arranca a caminar hacia la resortera DE INMEDIATO, en paralelo
      // -no hace falta esperar a que la anterior termine de volar-.
      projectile = bird;
      birdLaunched = true;
      launchTime = millis();

      if (birdQueue.length > 0) {
        bird = birdQueue[0];
        isAnimatingBird = true;
        Matter.Body.setStatic(bird.body, true);
      } else {
        bird = null;
      }
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
    // Espaciado más angosto que antes: con 5 aves en cola, 60px por ave
    // sacaba a las últimas fuera del borde izquierdo de la pantalla.
    let xPos = 170 - (i * 35);
    // Mismo punto exacto donde toca el suelo la resortera (su madera
    // llega hasta "groundY"; con radio 25, el borde inferior del ave
    // queda justo ahí, ni más arriba ni más abajo).
    let yPos = groundY - 25;

    let img = birdImages[i % birdImages.length];
    let b = new Bird(xPos, yPos, 25, img);

    // TODAS las aves arrancan estáticas y en su lugar de la fila,
    // incluida la primera: camina hacia la resortera como cualquier
    // otra (ver isAnimatingBird más abajo), sin trato especial.
    Matter.Body.setStatic(b.body, true);
    birdQueue.push(b);
  }

  bird = birdQueue[0];
  isAnimatingBird = true;

  slingshot = new Slingshot(targetPos, bird.body, imgSlingshot, audioStreched);

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
  projectile = null;
  birdLaunched = false;
  isAnimatingBird = false;
  score = 0;
  roundResult = null;

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

  // Limpieza del ave que ya voló (projectile), independiente de "bird"
  // (que ya avanzó a la siguiente desde que se lanzó ésta).
  if (isPlaying && birdLaunched && projectile) {
    let currentTime = millis();
    let speed = projectile.body.speed;

    if (currentTime - launchTime > TIME_TO_WAIT || (speed < 0.2 && currentTime - launchTime > SETTLE_GRACE)) {
      World.remove(world, projectile.body);
      projectile = null;
      birdLaunched = false;
    }
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    let box = boxes[i];
    if (isPlaying) box.checkLifetime(playBounds);
    box.show();

    if (box.isDead) {
      // Opcional: añadir una pequeña explosión o efecto de polvo aquí
      // explosions.push(new Explosion(box.body.position.x, box.body.position.y, explosionImg));
      score += POINTS_PER_BOX;
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
      let targetX = 170 - (i * 35);
      let targetY = groundY - 25; // mismo punto donde toca el suelo la resortera

      let currentPos = b.body.position;
      let nextX = lerp(currentPos.x, targetX, 0.1);
      let nextY = lerp(currentPos.y, targetY, 0.1);

      Matter.Body.setPosition(b.body, { x: nextX, y: nextY });
    }

    b.show();
  }

  // El forro de cuero de la resortera va DETRÁS del ave (se dibuja antes
  // que bird.show()), mientras que las bandas y la madera de la
  // horqueta van delante (dibujadas después, dentro de slingshot.show())
  slingshot.showBack();

  if (bird) {
    bird.show();
  }

  if (projectile) {
    projectile.show();
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
      score += POINTS_PER_PIG;
      World.remove(world, pigs[i].body);
      pigs.splice(i, 1);
    }
  }

  // Victoria: todos los cerdos murieron, sin importar cuántas aves
  // queden (incluso si el último tiro todavía está en el aire). Derrota:
  // no queda ave por lanzar, ninguna en cola, Y el último proyectil ya
  // terminó de volar -se espera a que se resuelva por si todavía llega
  // a matar al último cerdo-. Se revisa acá, después de remover los
  // cerdos muertos de este mismo frame, para que el conteo sea exacto.
  if (isPlaying && pigs.length === 0) {
    roundResult = "win";
    gameState = "roundOver";
  } else if (isPlaying && bird === null && birdQueue.length === 0 && !projectile) {
    roundResult = "lose";
    gameState = "roundOver";
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
    drawScore();
  } else if (gameState === "paused") {
    drawScore();
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

// mouseX/mouseY de p5 están en coordenadas reales de pantalla; los
// cuerpos físicos (aves, cajas, etc.) viven en el espacio lógico
// GAME_WIDTH x GAME_HEIGHT. Convierte de uno a otro (inverso de la
// transformación que ya se aplica en draw() con translate/scale).
function screenToLogical(x, y) {
  return {
    x: (x - viewOffsetX) / viewScaleX,
    y: (y - viewOffsetY) / viewScaleY,
  };
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
// Puntaje en pantalla, esquina superior izquierda, en coordenadas
// reales (igual que el resto del HUD, fuera del espacio lógico escalado)
function drawScore() {
  push();
  noStroke();
  fill(0, 0, 0, 150);
  rectMode(CORNER);
  const boxW = min(width, height) * 0.32;
  const boxH = min(width, height) * 0.08;
  rect(20, 20, boxW, boxH, 8);

  fill(255);
  stroke(60, 30, 10);
  strokeWeight(2);
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  textSize(boxH * 0.45);
  text(`Puntaje: ${score}`, 20 + boxW * 0.06, 20 + boxH / 2);
  pop();
}

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

// Panel compartido: fondo oscurecido + (opcional) medalla + título +
// una columna de botones. Usado tanto por la pantalla de pausa como
// por la de fin de ronda.
function drawOverlayPanel(title, buttons, medalImg) {
  push();
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  pop();

  let titleY = height * 0.28;

  if (medalImg) {
    const medalW = min(width, height) * 0.24;
    const medalH = medalW * (medalImg.height / medalImg.width);
    push();
    imageMode(CENTER);
    image(medalImg, width / 2, height * 0.24, medalW, medalH);
    pop();
    titleY = height * 0.46;
  }

  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  fill(255);
  stroke(60, 30, 10);
  strokeWeight(4);
  textSize(min(width, height) * (medalImg ? 0.055 : 0.07));
  text(title, width / 2, titleY);
  pop();

  const btnW = min(width, height) * 0.26;
  const btnH = btnW * 0.3;
  const gap = btnH * 0.5;
  const totalH = buttons.length * btnH + (buttons.length - 1) * gap;
  const centerY = medalImg ? height * 0.68 : height / 2;
  const firstCy = centerY - totalH / 2 + btnH / 2;

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
  const buttons = [
    { rect: retryButton, label: "Reintentar" },
    { rect: menuButton, label: "Menú Principal" },
  ];

  if (roundResult === "win") {
    const medal = getMedalForScore(score);
    drawOverlayPanel(`¡Nivel superado! Puntaje: ${score}`, buttons, medal);
  } else {
    drawOverlayPanel(`¡Sin aves! Puntaje: ${score}`, buttons);
  }
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
      return;
    }

    // Elegir qué ave lanzar: se puede en cualquier momento -incluso
    // mientras la anterior sigue en el aire (projectile), o mientras
    // la actual ya está enganchada pero todavía en reposo-, excepto
    // mientras se la está apuntando/estirando de verdad.
    if (!slingshot.isAiming()) {
      const logical = screenToLogical(mouseX, mouseY);

      for (const b of birdQueue) {
        if (b === bird) continue;

        if (dist(logical.x, logical.y, b.body.position.x, b.body.position.y) < 25) {
          // Si la que se reemplaza ya estaba enganchada a la resortera
          // (en reposo), hay que soltarla del constraint y volverla
          // estática, o quedaría cayendo por gravedad mientras el loop
          // de la cola intenta reacomodarla en su lugar.
          if (bird && slingshot.hasBird()) {
            slingshot.detach();
            Matter.Body.setStatic(bird.body, true);

            // La resortera está más arriba que la fila de espera: sin
            // esto, se ve flotando ahí hasta que el desplazamiento
            // suave de la cola la alcanza. Se fija de una la posición
            // COMPLETA (x e y) a su lugar exacto en la fila -no solo
            // la altura, dejando el eje X "para después"-, así no
            // queda ninguna duda de que arranca ya en su sitio.
            const idx = birdQueue.indexOf(bird);
            Matter.Body.setPosition(bird.body, {
              x: 170 - (idx * 35),
              y: groundY - 25,
            });
          }

          Matter.Body.setStatic(b.body, true);
          bird = b;
          isAnimatingBird = true;
          break;
        }
      }
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
