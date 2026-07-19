class Pig extends Animal {
  constructor(x, y, r, imgArray) {
    super(x, y, r, 1, imgArray[0]); 
    this.imgArray = imgArray;
    this.health = 255;
    this.isDead = false;

    // Lifetime: momento en que salió del área jugable (null = está dentro)
    this.offscreenSince = null;
  }

hit(force, hitSounds, deathSound) {
  if (this.isDead) return;

  this.health -= force;

  if (this.health <= 0) {
    this.isDead = true;
    if (deathSound) {
      deathSound.play();
    }
  } else if (force > 5) {
    if (hitSounds && hitSounds.length > 0) {
      let randomSound = random(hitSounds);
      randomSound.play();
    }
  }
}

  // Limpieza de seguridad: si el cerdo queda fuera del área jugable
  // (empujado más allá de los muros, tunneling físico, etc.) y no
  // regresa en "graceMs", se destruye. No afecta cerdos dentro del nivel.
  checkLifetime(bounds, graceMs = 3000) {
    if (this.isDead) return;

    const pos = this.body.position;
    const margin = 60;
    const outOfBounds =
      pos.x < bounds.left - margin || pos.x > bounds.right + margin ||
      pos.y < bounds.top - margin || pos.y > bounds.bottom + margin;

    if (outOfBounds) {
      if (this.offscreenSince === null) {
        this.offscreenSince = millis();
      } else if (millis() - this.offscreenSince > graceMs) {
        this.isDead = true;
      }
    } else {
      this.offscreenSince = null;
    }
  }

  show() {
    if (this.isDead) return;

    if (this.health > 170) {
      this.img = this.imgArray[0]; 
    } else if (this.health > 85) {
      this.img = this.imgArray[1]; 
    } else {
      this.img = this.imgArray[2]; 
    }

    push();
    super.show(); 
    pop();
  }
}