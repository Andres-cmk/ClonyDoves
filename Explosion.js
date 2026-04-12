class Explosion {
  constructor(x, y, img) {
    this.x = x;
    this.y = y;
    this.img = img;
    this.timer = 40; 
  }

  show() {
    push();
    imageMode(CENTER);
    image(this.img, this.x, this.y, 100, 100);
    this.timer--;
    pop();
  }

  isFinished() {
    return this.timer <= 0;
  }
}