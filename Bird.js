// Bird.js
class Bird extends Animal {
  constructor(x, y, r, img) {
    super(x, y, r, 2, img); 
    this.history = [];      
  }

  show() {
    if (this.body.speed > 2 && this.body.position.x > 170) {
      this.history.push({ 
        x: this.body.position.x, 
        y: this.body.position.y 
      });
    }

    for (let i = 0; i < this.history.length; i++) {
      let pos = this.history[i];
      
      let opacity = map(i, 0, this.history.length, 0, 150);
      
      fill(255, opacity); 
      noStroke();
      ellipse(pos.x, pos.y, 8, 8); 
    }

    if (this.history.length > 25) {
      this.history.shift(); 
    }

    super.show(); 
  }
}