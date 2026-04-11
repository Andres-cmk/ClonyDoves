// Slingshot
class Slingshot {
  constructor(bird){
    this.sling = Constraint.create({
      pointA: {
        x: bird.body.position.x,
        y: bird.body.position.y
      },
      bodyB: bird.body,
      length: 5,
      stiffness: 0.05,
      damping : 0.05
    });
    World.add(world, this.sling);
  }
  
  fly(mc){      
    if (this.sling.bodyB &&
      mc.mouse.button === -1 &&
      this.sling.bodyB.position.x >
      this.sling.pointA.x + 10) {
      this.sling.bodyB.collisionFilter.category = 1;
      this.sling.bodyB = null;
    }
  }
  
  hasBird(){
    return this.sling.bodyB != null;
  }
  
  attach(bird){
    this.sling.bodyB = bird.body;
  }
  
  show(){
    if (this.sling.bodyB){
      line(this.sling.pointA.x,
        this.sling.pointA.y,
        this.sling.bodyB.position.x,
        this.sling.bodyB.position.y);
    }
  }
}
