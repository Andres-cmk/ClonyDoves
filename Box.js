// Box
class Box {
  constructor(x, y, w, h, img, options={}){
    this.w = w;
    this.h = h;
    this.img = img;
    this.body = Bodies.rectangle(x, y, w, h, options);
    
    World.add(world, this.body);
  }
  
  show(){
    push();
    translate(this.body.position.x,
      this.body.position.y);
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
