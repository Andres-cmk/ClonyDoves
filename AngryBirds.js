const { Bodies, Engine, World, Events, Body,
  Mouse, MouseConstraint, Constraint } = Matter;

let engine, world, ground,
  boxes=[], bird, pigs = [], slingshot,
  bgImg, boxImg, birdImages = [], pigImg;

function setup() {
  const canvas = createCanvas(800, 560);
  
  engine = Engine.create();
  world = engine.world;
  
  const mouse = Mouse.create(canvas.elt);
  mouse.pixelRatio = pixelDensity();
  
  const mc = MouseConstraint.create(engine, {
    mouse: mouse,
    collisionFilter: {mask: 2}
  });
  World.add(world, mc);
  
  bgImg = loadImage("background.jpg");
  boxImg = loadImage("box.png");
  pigImg = loadImage("pig.png");
  birdImages = [
    loadImage("red.png"),
    loadImage("chuck.png"),
    loadImage("bomb.png")
  ]
  
  ground = new Ground(width/2, height-10,
    width, 20);
  
  for(let i=1; i<=8; i++){
    const y = height - 50*i - 10;
    let box = new Box(600, y, 50, 50, boxImg);
    boxes.push(box);
    
    box = new Box(700, y, 50, 50, boxImg);
    boxes.push(box);
  }
  
  const y = height - 50*9;
  let pig = new Pig(600, y, 25, pigImg);
  pigs.push(pig);
  
  pig = new Pig(700, y, 25, pigImg);
  pigs.push(pig);
  
  bird = new Bird(150, 450, 25, birdImages[0]);
  slingshot = new Slingshot(bird);
  
  Events.on(engine, "afterUpdate", () => {
    slingshot.fly(mc);
  });
}


function draw() {
  background(128);
  image(bgImg, 0, 0, width, height)
  
  Engine.update(engine);
  
  ground.show();
  
  for (const box of boxes){
    box.show();
  }
  
  for (const pig of pigs){
    pig.show();
  }
  
  slingshot.show();
  bird.show();
}

function keyPressed(){
  if (key === " " && !slingshot.hasBird()){
    World.remove(world, bird.body);
    
    index = floor(random(0, birdImages.length));
    
    bird = new Bird(150, 450, 25,
      birdImages[index]);
    slingshot.attach(bird);
  }
}
