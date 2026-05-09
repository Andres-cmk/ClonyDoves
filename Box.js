// Box
class Box {
  constructor(x, y, w, h, imgArray, options = {}) {
    this.w = w;
    this.h = h;
    this.imgArray = Array.isArray(imgArray) ? imgArray : [imgArray]; 
    this.img = this.imgArray[0]; // Empezar con la imagen de vida completa
    this.body = Bodies.rectangle(x, y, w, h, options);

    // Health logic
    this.maxHealth = options.health || 100;
    this.health = this.maxHealth;
    this.isDead = false;

    World.add(world, this.body);
  }

  hit(force) {
    if (this.isDead) return;

    // Decrease health based on force
    this.health -= force;

    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  show() {
    if (this.isDead) return;

    // Actualizar la imagen basada en la vida actual (4 estados)
    if (this.imgArray.length === 4) {
      let healthPercent = this.health / this.maxHealth;
      if (healthPercent > 0.75) {
        this.img = this.imgArray[0];
      } else if (healthPercent > 0.50) {
        this.img = this.imgArray[1];
      } else if (healthPercent > 0.25) {
        this.img = this.imgArray[2];
      } else {
        this.img = this.imgArray[3];
      }
    }

    push();
    translate(this.body.position.x, this.body.position.y);
    rotate(this.body.angle);

    if (this.img) {
      imageMode(CENTER);
      image(this.img, 0, 0, this.w, this.h);
    } else {
      rectMode(CENTER);
      noStroke();
      fill(86, 125, 70);
      rect(0, 0, this.w, this.h);
    }
    pop();
  }
}
