// Ground
class Ground extends Box {
  constructor(x, y, w, h, img){
    super(x, y, w, h, img, {
      isStatic: true
    });
  }
}
