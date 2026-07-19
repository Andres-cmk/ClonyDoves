// Slingshot
class Slingshot {
  constructor(bird, img, audio){

    this.sling = Constraint.create({
      pointA: {
        x: bird.body.position.x,
        y: bird.body.position.y
      },
      bodyB: bird.body,
      length: 2,
      stiffness: 0.05,
      damping : 0.05,
    });

    this.img = img;
    this.audio = audio;
    this.wasStretched = false;
    this.stretchThreshold = 45;
    this.relaxThreshold = 20;
    World.add(world, this.sling);
  }
  
  fly(mc) {      
    if (this.sling.bodyB && mc.mouse.button === -1) { 
      const d = dist(
        this.sling.bodyB.position.x, 
        this.sling.bodyB.position.y, 
        this.sling.pointA.x, 
        this.sling.pointA.y
      );

      if (d > 20) { 
        this.sling.bodyB = null; 
      }
    }
  }
  
  hasBird(){
    return this.sling.bodyB != null;
  }
  
  attach(bird){
    this.sling.bodyB = bird.body;
    this.wasStretched = false;
  }



  playStretchAudio(){
    if (!this.audio || !this.sling.bodyB){
      this.wasStretched = false;
      return;
    }

    const distance = dist(
      this.sling.pointA.x,
      this.sling.pointA.y,
      this.sling.bodyB.position.x,
      this.sling.bodyB.position.y
    );

    if (!this.wasStretched && distance > this.stretchThreshold){
      this.wasStretched = true;

      if (typeof this.audio.time === "function"){
        this.audio.time(0);
      }

      this.audio.play();
    } else if (this.wasStretched && distance < this.relaxThreshold){
      this.wasStretched = false;
    }
  }
  

  // Estela de puntos que muestra la trayectoria estimada del lanzamiento
  // mientras se estira el ave hacia atrás. Es una aproximación visual
  // (velocidad inicial proporcional al estiramiento + gravedad del
  // mundo), no una réplica exacta del resorte de Matter.js, pero da una
  // guía razonable de hacia dónde va a salir disparada.
  showTrajectory() {
    if (!this.sling.bodyB) return;

    const bird = this.sling.bodyB;
    const dx = this.sling.pointA.x - bird.position.x;
    const dy = this.sling.pointA.y - bird.position.y;
    const pullDistance = dist(0, 0, dx, dy);

    // Evita dibujar la estela cuando el ave recién llega a la resortera
    // y todavía está casi en reposo (sin estirar)
    if (pullDistance < this.relaxThreshold) return;

    // "t" representa pasos reales del motor de física (un Engine.update
    // por frame, ~60/s). vx/vy están en las mismas unidades que Matter
    // usa para body.velocity (píxeles por paso), y "gravity" es el valor
    // real que Matter aplica cada paso (world.gravity.y * scale ≈
    // 0.001), así que el término 0.5*gravity*t² es matemáticamente
    // consistente con la caída real del motor, no una curva inventada.
    const LAUNCH_POWER = 0.014;
    const vx = dx * LAUNCH_POWER;
    const vy = dy * LAUNCH_POWER;
    const gravity = world.gravity.y * world.gravity.scale;

    push();
    noStroke();
    fill(255, 255, 255, 200);

    // La gravedad real de Matter es muy débil por paso (~0.001), así
    // que su efecto solo se nota mirando varios cientos de pasos hacia
    // adelante (varios segundos de vuelo), no unas pocas decenas.
    const POINTS = 24;
    const STEP = 14;
    for (let i = 1; i <= POINTS; i++) {
      const t = i * STEP;
      const px = bird.position.x + vx * t;
      const py = bird.position.y + vy * t + 0.5 * gravity * t * t;

      if (py > GAME_HEIGHT || px > GAME_WIDTH || px < 0) break;

      const dotSize = map(i, 1, POINTS, 7, 2);
      ellipse(px, py, dotSize, dotSize);
    }
    pop();
  }

  show(){
    this.playStretchAudio();

    if (this.sling.bodyB){
      push();
      stroke(48, 22, 8);
      strokeWeight(6);
      line(this.sling.pointA.x,
        this.sling.pointA.y,
        this.sling.bodyB.position.x,
        this.sling.bodyB.position.y);
      pop();

      this.showTrajectory();
    }


    // La imagen debe llegar hasta el suelo del nivel (groundY, definido
    // en AngryBirds.js) en vez de usar una altura fija: con la resortera
    // ubicada más arriba (pointA) que antes, una altura fija de 100 la
    // dejaba flotando sin tocar el piso.
    const imgW = 40;
    const imgTopY = this.sling.pointA.y - 10;
    const imgH = max(100, groundY - imgTopY);
    image(this.img, this.sling.pointA.x - imgW / 2, imgTopY, imgW, imgH);
  }
}
