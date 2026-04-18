class Animal {
  
  constructor(x, y, r, category, img){
    this.img = img;
    this.body = Bodies.circle(x, y, r, {
      restitution: 0.6,
      collisionFilter: {
        category: category,
        group: -1 
      }
    });
    
    Body.setMass(this.body, 3);
    
    World.add(world, this.body);
  }
  
  show() {
    push();
    translate(this.body.position.x,
      this.body.position.y);
    rotate(this.body.angle);
    
    if (this.img) {
      imageMode(CENTER);
      image(this.img, 0, 0,
        2 * this.body.circleRadius,
        2 * this.body.circleRadius);
    } else {
      ellipse(0, 0,
        2 * this.body.circleRadius,
        2 * this.body.circleRadius);
    }
    pop();
  }
}
