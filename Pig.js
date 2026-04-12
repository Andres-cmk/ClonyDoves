class Pig extends Animal {
  constructor(x, y, r, imgArray) {
    super(x, y, r, 1, imgArray[0]); 
    this.imgArray = imgArray; 
    this.health = 255;
    this.isDead = false;
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