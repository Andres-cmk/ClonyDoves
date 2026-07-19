# Angry Birds - ClonyDoves

Clon de Angry Birds hecho con [p5.js](https://p5js.org/) y [Matter.js](https://brm.io/matter-js/) para el motor de físicas. Corre completamente en el navegador, sin necesidad de instalar nada.

## Cómo jugar

1. Abrí `index.html` en el navegador (o serví la carpeta con un servidor local, ver más abajo).
2. En la pantalla de inicio, presioná **Iniciar Juego**.
3. Arrastrá el ave hacia atrás en la resortera y soltala para lanzarla.
4. También podés presionar **barra espaciadora** para traer la siguiente ave a la resortera.
5. Derribá la estructura de bloques para golpear a los cerdos antes de quedarte sin aves.

## Cómo correrlo localmente

Es un proyecto 100% estático (HTML + JS), así que solo necesita un servidor local simple:

```bash
python -m http.server 8080
```

Y abrir `http://localhost:8080/index.html` en el navegador.

## Estructura del proyecto

```
index.html        Punto de entrada, carga p5.js, matter.js y todos los scripts
AngryBirds.js      Sketch principal: setup(), draw(), menú, nivel, cámara/escala responsive
Animal.js          Clase base para aves y cerdos (cuerpo físico circular + render)
Bird.js            Ave jugable (rastro de movimiento al volar)
Pig.js             Cerdo enemigo (vida, sprites por daño, sonidos)
Box.js             Bloques de la estructura (vida, sprites por daño, lifetime)
Ground.js          Suelo y muros invisibles del nivel (extiende Box, cuerpos estáticos)
Slingshot.js        Resortera (textura, banda elástica, sonido de estiramiento)
Explosion.js       Efecto visual de explosión al morir un cerdo
images/            Sprites y fondo
audios/            Efectos de sonido
libraries/         p5.js y matter.js vendorizados
```

## Características

- **Nivel diseñado a mano**: pirámide de bloques de madera con dos cerdos escondidos dentro, suelo y muros invisibles.
- **Cerdos y bloques con vida**: cambian de sprite según el daño recibido y se destruyen al llegar a 0 de vida.
- **Cola de aves**: 4 aves distintas (roja, amarilla, bomba) que avanzan en pantalla a medida que se lanzan.
- **Lifetime de seguridad**: si un cerdo o bloque queda fuera del área jugable (por un empujón raro, tunneling físico, etc.) y no vuelve en unos segundos, se limpia automáticamente. Los objetos dentro del nivel no desaparecen solos.
- **Pantalla completa y responsive**: el canvas ocupa toda la ventana y se reajusta si la cambiás de tamaño, sin tocar la física del nivel (que vive en una resolución lógica fija).
- **Menú inicial**: pantalla de bienvenida con botón para iniciar; la física del nivel queda congelada hasta que empezás a jugar.

## Tecnologías

- [p5.js](https://p5js.org/) — renderizado y bucle de juego
- [Matter.js](https://brm.io/matter-js/) — motor de físicas 2D
