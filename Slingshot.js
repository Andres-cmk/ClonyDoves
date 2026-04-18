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
    }

  
    image(this.img, this.sling.pointA.x - 20,
      this.sling.pointA.y - 10, 40, 100);
  }
}
