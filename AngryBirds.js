const { Bodies, Engine, World, Events, Body,
  Mouse, MouseConstraint, Constraint } = Matter;

//matters
let engine, world;


// worlds
let ground; 
let bgImg;

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

// Explosion
let explosions = [];
let explosionImg;


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
  const canvas = createCanvas(800, 560);
  
  engine = Engine.create();
  world = engine.world;
  
  const mouse = Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  
  const mc = MouseConstraint.create(engine, {
    mouse: mouse,
    collisionFilter: {
      mask: 0xFFFF 
    }
  });

  World.add(world, mc);
  

  ground = new Ground(width/2, height-10, width, 20);
  
  // Muros invisibles para evitar que los cerdos (y aves) salgan del recuadro
  let leftWall = new Ground(-10, height/2, 20, height*2);
  let rightWall = new Ground(width + 10, height/2, 20, height*2);
  let ceiling = new Ground(width/2, -50, width*2, 100);
  
  // --- CONSTRUCCIÓN DEL NIVEL ---
  let startX = 650; 
  let groundY = height - 20;

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
    let yPos = height - 55; 
    
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


function draw() {
  background(128);
  image(bgImg, 0, 0, width, height);
  
  Engine.update(engine);
  
  ground.show();

  if (birdLaunched && bird) {
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

  for (let i = boxes.length - 1; i >= 0; i--) {
    let box = boxes[i];
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

    let targetX = 120 - (i * 60); 
    let targetY = height - 55;

    let currentPos = b.body.position;
    let nextX = lerp(currentPos.x, targetX, 0.1);
    let nextY = lerp(currentPos.y, targetY, 0.1);

    Matter.Body.setPosition(b.body, { x: nextX, y: nextY });
    
    b.show();
  }

  if (bird) {
    bird.show();
  }

  if (isAnimatingBird && bird) {
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
    pigs[i].show();
    if (pigs[i].isDead) {
      let pPos = pigs[i].body.position;
      explosions.push(new Explosion(pPos.x, pPos.y, explosionImg));
      World.remove(world, pigs[i].body);
      pigs.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].show();
    if (explosions[i].isFinished()) {
      explosions.splice(i, 1);
    }
  }
  
  slingshot.show();
}

let isAnimatingBird = false;
let targetPos = { x: 150, y: 400 };

function keyPressed() {
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
