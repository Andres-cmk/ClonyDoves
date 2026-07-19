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
// enganchada en ella (apuntando); "projectiles" son las aves que ya
// salieron disparadas y siguen en pantalla, cada una con su propio
// timer de limpieza (launchTimeMs). Es un ARREGLO -no una sola- porque
// se puede lanzar la siguiente mientras la anterior todavía vuela; con
// una sola variable, el nuevo lanzamiento no se registraba hasta que
// la anterior expiraba, y su poder se activaba tarde o nunca.
let projectiles = [];

// El proyectil más reciente cuyo poder todavía puede activarse.
// Terence se saltea (no tiene poder activo): si fue el último en
// lanzarse, el click queda libre para seleccionar aves en la cola.
function newestActivatableProjectile() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.powerUsed && p.type !== "terence") return p;
  }
  return null;
}
const TIME_TO_WAIT = 10000; // antes 8000: un poco más de tiempo en pantalla tras lanzarse
const SETTLE_GRACE = 3500; // antes 2500: ídem, un poco más de margen al asentarse
let birdImages = []
let birdQueue = [];
const TOTAL_BIRDS = 5; // una de cada tipo: red, chuck, bomb, OldTerence, matilda
// Tipo de cada ave (mismo orden que birdImages/BIRD_TYPES), usado para
// saber qué poder activar con la barra espaciadora en pleno vuelo.
const BIRD_TYPES = ["red", "chuck", "bomb", "terence", "matilda"];

// Categorías de colisión para que el mouse solo pueda arrastrar el ave
// que está enganchada a la resortera (apuntando), no cualquier otra
// cosa. Se cambia a DRAGGABLE_CATEGORY al engancharse (attach) y se
// vuelve a NORMAL_BIRD_CATEGORY al soltarse (fly/detach).
const NORMAL_BIRD_CATEGORY = 2;
const DRAGGABLE_CATEGORY = 4;

// Huevo de Matilda: cae por gravedad (aproximada) y explota al tocar
// el suelo o al vencerse su tiempo, como una mini bomba.
let eggs = [];
let eggImg;

class Egg {
  constructor(x, y, vx, vy, img) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.img = img;
    this.age = 0;
    this.maxAge = 120; // ~2s a 60fps, por si nunca toca el suelo
    this.size = 46; // más grande que antes (era 32)
    this.radius = this.size / 2; // usado para detectar choques con la estructura
  }

  update() {
    this.vy += 0.55; // antes 0.35: cae un poco más rápido
    this.x += this.vx;
    this.y += this.vy;
    this.age++;
  }

  // Explota al tocar el suelo, al vencerse su tiempo, o al salir del
  // área jugable (por si cae fuera de la pantalla). El choque contra
  // cajas/cerdos se revisa aparte, en eggHitsStructure() (draw()).
  shouldExplode(bounds) {
    return this.y >= groundY - 10 ||
      this.age >= this.maxAge ||
      this.x < bounds.left - 100 || this.x > bounds.right + 100;
  }

  show() {
    push();
    imageMode(CENTER);
    image(this.img, this.x, this.y, this.size, this.size);
    pop();
  }
}

// Efecto visual de la onda de Red: se desplaza en la dirección de
// vuelo y va agrandándose, con un fundido de salida, hasta desaparecer.
let shockwaves = [];
let redShockwaveImg;

class Shockwave {
  constructor(x, y, dirX, dirY, img) {
    this.x = x;
    this.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.img = img;
    this.age = 0;
    this.maxAge = 26; // menos de medio segundo a 60fps
    this.baseSize = 50;
    this.growth = 7; // cuánto se agranda por frame
    this.speed = 9; // qué tan rápido se desplaza
  }

  update() {
    this.x += this.dirX * this.speed;
    this.y += this.dirY * this.speed;
    this.age++;
  }

  isFinished() {
    return this.age >= this.maxAge;
  }

  show() {
    const size = this.baseSize + this.growth * this.age;
    const alpha = map(this.age, 0, this.maxAge, 255, 0);

    push();
    translate(this.x, this.y);
    rotate(atan2(this.dirY, this.dirX));
    tint(255, alpha);
    imageMode(CENTER);
    image(this.img, 0, 0, size, size * (this.img.height / this.img.width));
    pop();
  }
}


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
let medalsButton = { x: 0, y: 0, w: 0, h: 0 };
let backButton = { x: 0, y: 0, w: 0, h: 0 };


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
    eggImg = loadImage("./images/matilda_egg.png");
    redShockwaveImg = loadImage("./images/red_shockwave.png");
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
      // Solo puede agarrar/arrastrar cuerpos de esta categoría (ver
      // DRAGGABLE_CATEGORY): antes (0xFFFF) se podía arrastrar
      // cualquier ave, caja o cerdo con el mouse, lo cual pisaba el
      // click para activar poderes en el ave que estaba en vuelo.
      mask: DRAGGABLE_CATEGORY
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
    // OJO: acá NO se exige que el proyectil anterior haya terminado -esa
    // condición (el viejo birdLaunched === false) hacía que un tiro
    // rápido no se registrara hasta que el anterior expirara, y su
    // poder se activaba tarde o nunca.
    if (!isAnimatingBird && bird && !slingshot.hasBird()) {

      // Sacamos de la cola AL LANZAR para que las demás aves avancen en la pantalla
      if (birdQueue.includes(bird)) {
        let index = birdQueue.indexOf(bird);
        birdQueue.splice(index, 1);
      }

      // El ave recién lanzada se suma a "projectiles" con su propio
      // timer, y la siguiente de la cola arranca a caminar hacia la
      // resortera DE INMEDIATO, en paralelo.
      bird.launchTimeMs = millis();
      // Salvaguarda: una vez lanzada, jamás se puede volver a enganchar
      // ni arrastrar, sin importar dónde rebote o quede cerca (attach()
      // la rechaza si ve este flag). Se refuerza también la categoría
      // de colisión por si acaso, aunque fly() ya la había reseteado.
      bird.launched = true;
      bird.body.collisionFilter.category = NORMAL_BIRD_CATEGORY;
      projectiles.push(bird);

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

  // Ya no hay muros/techo invisibles: una trayectoria real puede sacar
  // a un ave, cerdo o caja de la pantalla, y si la parábola/física la
  // trae de vuelta, reaparece sola. Lo que se pierde para siempre se
  // limpia solo con el tiempo (Box/Pig.checkLifetime, y el timeout del
  // proyectil en draw()) - no hace falta ningún límite artificial.

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
    let type = BIRD_TYPES[i % BIRD_TYPES.length];
    let b = new Bird(xPos, yPos, 25, img, type);

    // OldTerence no tiene poder activo: por defecto es más pesado, así
    // que golpea más fuerte y le cuesta menos derribar lo que tiene
    // enfrente (efecto puramente físico, vía la masa de Matter.js).
    if (type === "terence") {
      Matter.Body.setMass(b.body, 8);
    }

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
  eggs = [];
  shockwaves = [];
  bird = null;
  projectiles = [];
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

  if (gameState === "medals") {
    drawMedalsScreen();
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

  // Limpieza de las aves que ya volaron, cada una con su propio timer
  // (pueden coexistir varias en pantalla si se lanzan rápido seguido).
  if (isPlaying) {
    const currentTime = millis();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const elapsed = currentTime - p.launchTimeMs;

      if (elapsed > TIME_TO_WAIT || (p.body.speed < 0.2 && elapsed > SETTLE_GRACE)) {
        World.remove(world, p.body);
        projectiles.splice(i, 1);
      }
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

  for (const p of projectiles) {
    p.show();
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
  } else if (isPlaying && bird === null && birdQueue.length === 0 && projectiles.length === 0 && eggs.length === 0) {
    // Se espera también a que no queden huevos de Matilda cayendo, por
    // si todavía llegan a matar al último cerdo.
    roundResult = "lose";
    gameState = "roundOver";
  }

  // Huevo de Matilda: cae, y explota al tocar el suelo / vencerse su
  // tiempo / salirse del área jugable. Solo avanza mientras se juega.
  if (isPlaying) {
    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      egg.update();
      egg.show();

      if (eggHitsStructure(egg) || egg.shouldExplode(playBounds)) {
        // Antes (100, 140) casi nunca alcanzaba para romper una caja
        // entera (100 de vida): solo si el huevo caía casi exacto en
        // su centro. Con más radio y fuerza, rompe bloques de verdad
        // aunque el impacto no sea perfecto.
        explodeAt(egg.x, egg.y, 130, 210);
        eggs.splice(i, 1);
      }
    }
  }

  // Onda de Red: se desplaza y se agranda hasta desvanecerse.
  if (isPlaying) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.update();
      sw.show();
      if (sw.isFinished()) {
        shockwaves.splice(i, 1);
      }
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

  // Botón secundario, más chico, para ver la explicación de las medallas
  medalsButton.w = startButton.w * 0.7;
  medalsButton.h = startButton.h * 0.8;
  medalsButton.x = width / 2 - medalsButton.w / 2;
  medalsButton.y = startButton.y + startButton.h + min(width, height) * 0.12;

  const hoveringMedals = isMouseOver(medalsButton);

  push();
  strokeWeight(2);
  stroke(255);
  fill(hoveringMedals ? color(255, 255, 255, 60) : color(255, 255, 255, 25));
  rectMode(CORNER);
  rect(medalsButton.x, medalsButton.y, medalsButton.w, medalsButton.h, 10);
  noStroke();
  fill(255);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(medalsButton.h * 0.4);
  text("Medallas", width / 2, medalsButton.y + medalsButton.h / 2);
  pop();
}

// Pantalla de explicación de medallas, accedida desde el menú
// principal. Muestra las 3 medallas con su rango de puntaje y una
// breve descripción de cada una.
function drawMedalsScreen() {
  background(20);
  image(bgImg, 0, 0, width, height);

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
  textSize(min(width, height) * 0.06);
  text("Medallas", width / 2, height * 0.1);
  pop();

  const medals = [
    {
      img: medalEasyImg,
      range: `0 - ${MEDAL_MEDIUM_SCORE - 1} puntos`,
      desc: "Terminaste el nivel. Todo puntaje cuenta: cada intento suma experiencia.",
    },
    {
      img: medalMediumImg,
      range: `${MEDAL_MEDIUM_SCORE} - ${MEDAL_HARD_SCORE - 1} puntos`,
      desc: "Buen despeje de la estructura, derribando bastante en el camino.",
    },
    {
      img: medalHardImg,
      range: `${MEDAL_HARD_SCORE}+ puntos`,
      desc: "Dominaste el nivel por completo, aprovechando casi cada golpe.",
    },
  ];

  const colW = width / 3;
  const medalSize = min(width, height) * 0.2;
  const medalCy = height * 0.42;

  medals.forEach((m, i) => {
    const cx = colW * i + colW / 2;
    const medalH = medalSize * (m.img.height / m.img.width);

    push();
    imageMode(CENTER);
    image(m.img, cx, medalCy, medalSize, medalH);
    pop();

    push();
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    fill(255);
    stroke(60, 30, 10);
    strokeWeight(2);
    textSize(min(width, height) * 0.024);
    text(m.range, cx, medalCy + medalH / 2 + min(width, height) * 0.05);
    pop();

    push();
    noStroke();
    fill(255);
    textStyle(NORMAL);
    textAlign(CENTER, CENTER);
    textSize(min(width, height) * 0.02);
    text(m.desc, cx, medalCy + medalH / 2 + min(width, height) * 0.12, colW * 0.85);
    pop();
  });

  const btnW = min(width, height) * 0.26;
  const btnH = btnW * 0.3;
  layoutButton(backButton, width / 2, height * 0.88, btnW, btnH);
  drawButton(backButton, "Volver");
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
    } else if (isMouseOver(medalsButton)) {
      gameState = "medals";
    }
    return;
  }

  if (gameState === "medals") {
    if (isMouseOver(backButton)) {
      gameState = "menu";
    }
    return;
  }

  if (gameState === "playing") {
    if (isMouseOver(pauseButton)) {
      gameState = "paused";
      return;
    }

    // Activar el poder tiene prioridad absoluta: mientras haya un ave
    // en pleno vuelo con el poder sin usar (la más reciente, si hay
    // varias volando), CUALQUIER click lo activa, sin importar dónde
    // caiga. Recién si no hay nada que activar se revisa la selección
    // de ave en la cola.
    const activatable = newestActivatableProjectile();
    if (activatable) {
      activatePower(activatable);
      return;
    }

    if (!slingshot.isAiming()) {
      const logical = screenToLogical(mouseX, mouseY);

      for (const b of birdQueue) {
        if (b === bird || b.launched) continue;

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

  // keyCode 32 como respaldo de key===" " (más confiable entre
  // navegadores/teclados para la barra espaciadora)
  if (key === " " || keyCode === 32) {
    // Poder especial: el proyectil más reciente con poder sin usar
    const activatable = newestActivatableProjectile();
    if (activatable) {
      activatePower(activatable);
    } else if (!slingshot.hasBird() && !bird && birdQueue.length > 0) {
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

// --- Poderes especiales de las aves ---
// Se activan una sola vez por tiro, con la barra espaciadora, mientras
// el ave está en pleno vuelo (ver keyPressed()). OldTerence no tiene
// poder activo: su ventaja (más pesado) ya se aplicó al crearla.

// Empujón hacia afuera compartido por la explosión de Bomb, el huevo
// de Matilda y la onda de Red.
function pushAway(body, x, y, strength) {
  const dx = body.position.x - x;
  const dy = body.position.y - y;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  Matter.Body.applyForce(body, body.position, {
    x: (dx / len) * 0.035 * strength,
    y: (dy / len) * 0.035 * strength,
  });
}

// Daño de área compartido por Bomb y el huevo de Matilda: todo lo que
// esté dentro de "radius" recibe daño (con caída lineal según
// distancia), un empujón hacia afuera, y se agrega el efecto visual
// de explosión que ya usábamos para cuando muere un cerdo.
function explodeAt(x, y, radius, force) {
  for (let i = pigs.length - 1; i >= 0; i--) {
    const p = pigs[i];
    const d = dist(x, y, p.body.position.x, p.body.position.y);
    if (d < radius) {
      const falloff = 1 - d / radius;
      p.hit(force * falloff, pigSounds, pigDeathSound);
      pushAway(p.body, x, y, falloff);
    }
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const d = dist(x, y, b.body.position.x, b.body.position.y);
    if (d < radius) {
      const falloff = 1 - d / radius;
      b.hit(force * falloff);
      pushAway(b.body, x, y, falloff);
    }
  }

  explosions.push(new Explosion(x, y, explosionImg));
}

// Chuck: impulso de velocidad hacia adelante, en la dirección en la
// que ya viene volando. Además de acelerarla mucho, se achata la
// componente vertical -si no, por más rápido que vaya, la gravedad la
// sigue curvando con el mismo ángulo original-, para que la trayectoria
// se vea lo más parecida posible a una línea recta.
function chuckBoost(b) {
  const CHUCK_BOOST = 5; // antes 7: pegaba demasiado fuerte al impactar (el daño depende de la velocidad)
  const FLATTEN = 0.15; // qué tanto se conserva del ángulo vertical original
  const vel = b.body.velocity;
  Matter.Body.setVelocity(b.body, {
    x: vel.x * CHUCK_BOOST,
    y: vel.y * CHUCK_BOOST * FLATTEN,
  });
}

// Bomb: explota en su propia posición y se destruye a sí misma (como
// en el juego real, termina el tiro de inmediato).
function bombExplode(b) {
  explodeAt(b.body.position.x, b.body.position.y, 150, 220);
  World.remove(world, b.body);
  const idx = projectiles.indexOf(b);
  if (idx !== -1) {
    projectiles.splice(idx, 1);
  }
}

// Matilda: suelta un huevo que cae y explota al tocar el suelo (radio
// más chico que la bomba: es un arma secundaria, no la propia ave).
// Le damos un empujón inicial hacia abajo para que caiga más decidida
// en vez de arrancar en caída libre desde velocidad cero.
function matildaDropEgg(b) {
  eggs.push(new Egg(b.body.position.x, b.body.position.y, b.body.velocity.x * 0.3, 4, eggImg));

  // Retroceso: al soltar el huevo hacia abajo, Matilda "rebota" un
  // poco hacia arriba, como reacción del lanzamiento.
  const vel = b.body.velocity;
  Matter.Body.setVelocity(b.body, { x: vel.x, y: vel.y - 6 });
}

// El huevo no es un cuerpo de Matter.js (es una simulación simple), así
// que sin esto atravesaba la estructura de largo hasta llegar al
// suelo. Se revisa a mano contra cajas (rectángulo) y cerdos (círculo).
function eggHitsStructure(egg) {
  for (const p of pigs) {
    if (dist(egg.x, egg.y, p.body.position.x, p.body.position.y) < egg.radius + p.body.circleRadius) {
      return true;
    }
  }

  for (const b of boxes) {
    const halfW = b.w / 2 + egg.radius;
    const halfH = b.h / 2 + egg.radius;
    if (Math.abs(egg.x - b.body.position.x) < halfW && Math.abs(egg.y - b.body.position.y) < halfH) {
      return true;
    }
  }

  return false;
}

// Red: onda destructiva en forma de cono, extendida en la dirección de
// vuelo actual. Es una adición propia -en el juego original Red no
// tiene poder-, pedida explícitamente para este clon.
function redShockwave(b) {
  const vel = b.body.velocity;
  const speed = max(0.1, dist(0, 0, vel.x, vel.y));
  const dirX = vel.x / speed;
  const dirY = vel.y / speed;
  const RANGE = 190; // antes 160: un poco más de alcance
  const HALF_WIDTH = 85; // antes 70: cono un poco más ancho
  const FORCE = 260; // antes 140: con la caída lineal, apenas rompía cajas muy cerca
  const PUSH = 0.22;

  function hitIfAhead(target, isPig) {
    const dx = target.body.position.x - b.body.position.x;
    const dy = target.body.position.y - b.body.position.y;
    const forward = dx * dirX + dy * dirY;
    const lateral = abs(dx * dirY - dy * dirX);

    if (forward > 0 && forward < RANGE && lateral < HALF_WIDTH) {
      const falloff = 1 - forward / RANGE;
      if (isPig) {
        target.hit(FORCE * falloff, pigSounds, pigDeathSound);
      } else {
        target.hit(FORCE * falloff);
      }
      Matter.Body.applyForce(target.body, target.body.position, {
        x: dirX * PUSH * falloff,
        y: dirY * PUSH * falloff - 0.025,
      });
    }
  }

  pigs.forEach(p => hitIfAhead(p, true));
  boxes.forEach(bx => hitIfAhead(bx, false));

  shockwaves.push(new Shockwave(b.body.position.x, b.body.position.y, dirX, dirY, redShockwaveImg));
}

// Dispara el poder correspondiente al tipo de ave, una sola vez por
// tiro (powerUsed evita reactivarlo).
function activatePower(b) {
  if (!b || b.powerUsed || b.type === "terence") return;
  b.powerUsed = true;

  if (b.type === "chuck") chuckBoost(b);
  else if (b.type === "bomb") bombExplode(b);
  else if (b.type === "matilda") matildaDropEgg(b);
  else if (b.type === "red") redShockwave(b);
}
