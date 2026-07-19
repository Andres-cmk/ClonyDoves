// Fracciones (medidas directamente sobre Slingshot_Classic.png, de
// 269x847px) de dónde empieza la franja marrón oscura (el "envoltorio"
// de cuero, justo debajo de la tapa clara de madera) en cada horqueta,
// para que las bandas elásticas salgan de ahí y no de la puntita clara.
const LEFT_TIP_FRACTION = { x: 0.2045, y: 0.1169 };
const RIGHT_TIP_FRACTION = { x: 0.8513, y: 0.1358 };

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
    this.cuffSize = 36; // diámetro del puño de cuero (círculo)
    World.add(world, this.sling);
  }

  // Puntas de la horqueta (donde salen las bandas) y datos de la
  // imagen de madera, compartido entre showBack() y show() para no
  // duplicar el cálculo.
  getForkGeometry() {
    const imgW = 40;
    const imgTopY = this.sling.pointA.y - 10;
    const imgH = max(100, groundY - imgTopY);
    const imgLeftX = this.sling.pointA.x - imgW / 2;

    return {
      imgW, imgTopY, imgH, imgLeftX,
      leftTip: {
        x: imgLeftX + imgW * LEFT_TIP_FRACTION.x,
        y: imgTopY + imgH * LEFT_TIP_FRACTION.y,
      },
      rightTip: {
        x: imgLeftX + imgW * RIGHT_TIP_FRACTION.x,
        y: imgTopY + imgH * RIGHT_TIP_FRACTION.y,
      },
    };
  }

  // Posición del puño de cuero: la del ave mientras está cargada, o el
  // punto de reposo de la resortera (pointA) cuando no hay ninguna -así
  // el puño (y sus bandas) se ven siempre, no solo con un ave puesta.
  getPouchPosition() {
    return this.sling.bodyB ? this.sling.bodyB.position : this.sling.pointA;
  }

  // Los dos puntos de anclaje sobre el puño de cuero, siempre en sus
  // COSTADOS izquierdo y derecho (en el eje horizontal del mundo), sin
  // rotar según el ángulo de estiramiento -rotarlos hacía que quedaran
  // arriba/abajo en vez de a los lados cuando el tiro era horizontal-.
  // Se asignan a izquierda/derecha según cuál costado queda más cerca
  // de cada punta de la horqueta.
  getBandAttachPoints(leftTip, rightTip) {
    const pouch = this.getPouchPosition();
    const halfSize = this.cuffSize / 2;

    const sideA = { x: pouch.x - halfSize, y: pouch.y };
    const sideB = { x: pouch.x + halfSize, y: pouch.y };

    const sideAIsLeft =
      dist(leftTip.x, leftTip.y, sideA.x, sideA.y) <
      dist(leftTip.x, leftTip.y, sideB.x, sideB.y);

    return sideAIsLeft
      ? { leftAttach: sideA, rightAttach: sideB }
      : { leftAttach: sideB, rightAttach: sideA };
  }
  
  fly(mc) {
    if (this.sling.bodyB) {
      // No dejar apuntar "hacia atrás": si el ave cruza al lado derecho
      // de pointA (ángulo entre -90° y 90°, plano cartesiano positivo),
      // se lanzaría en dirección contraria al nivel. Se frena en seco
      // en ese borde mientras se arrastra.
      if (this.sling.bodyB.position.x > this.sling.pointA.x) {
        Matter.Body.setPosition(this.sling.bodyB, {
          x: this.sling.pointA.x,
          y: this.sling.bodyB.position.y,
        });
        Matter.Body.setVelocity(this.sling.bodyB, {
          x: 0,
          y: this.sling.bodyB.velocity.y,
        });
      }
    }

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

  // Puño de cuero de la resortera (donde "se sienta" el ave), dibujado
  // detrás del ave para dar sensación de profundidad. Se ve siempre,
  // incluso sin ninguna ave cargada -en ese caso, en el punto de
  // reposo de la resortera-. En vez de una imagen (difícil de calibrar
  // sin poder probar el arrastre en vivo), es una forma simple: un
  // círculo oscuro rotado hacia la horqueta. También dibuja acá la
  // banda IZQUIERDA: al estar detrás del ave (no en show(), que se
  // dibuja después), queda tapada por ella en vez de sobreponerse
  // encima -la banda derecha sí queda delante-.
  showBack() {
    const pouch = this.getPouchPosition();
    const dx = this.sling.pointA.x - pouch.x;
    const dy = this.sling.pointA.y - pouch.y;
    // Sin ave, pouch === pointA (distancia 0): no hay una dirección real
    // hacia dónde rotar, así que usamos un ángulo fijo (mirando hacia
    // abajo) en vez de un atan2(0, 0) indefinido.
    const angle = (dx === 0 && dy === 0) ? HALF_PI : atan2(dy, dx);

    const { leftTip, rightTip } = this.getForkGeometry();
    const { leftAttach } = this.getBandAttachPoints(leftTip, rightTip);

    push();
    stroke(48, 22, 8);
    strokeWeight(5);
    line(leftTip.x, leftTip.y, leftAttach.x, leftAttach.y);
    pop();

    push();
    translate(pouch.x, pouch.y);
    rotate(angle);
    ellipseMode(CENTER);
    stroke(35, 18, 10);
    strokeWeight(2);
    fill(56, 30, 16);
    ellipse(0, 0, this.cuffSize, this.cuffSize);
    pop();
  }

  show(){
    this.playStretchAudio();

    const { imgW, imgTopY, imgH, imgLeftX, leftTip, rightTip } = this.getForkGeometry();

    // La banda DERECHA se dibuja siempre acá (delante del ave si hay
    // una, ya que este show() corre después de bird.show()). La
    // izquierda se dibuja en showBack(), antes del ave, para que quede
    // detrás. Sin ave, ambas usan el punto de reposo (pointA).
    const { rightAttach } = this.getBandAttachPoints(leftTip, rightTip);
    push();
    stroke(48, 22, 8);
    strokeWeight(5);
    line(rightTip.x, rightTip.y, rightAttach.x, rightAttach.y);
    pop();

    if (this.sling.bodyB) {
      this.showTrajectory();
    }

    image(this.img, imgLeftX, imgTopY, imgW, imgH);
  }
}
