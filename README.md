## Texture Projection Example

The goal of this project is to use texture projection in order to map an image in a 3d object. In order to work with projection transformations is important to define the different coordinate systems involved. There are several coordinate systems but for this project only world, clip and view space are important. World space as its name suggests is the coordinate system of all objects relative to a world, while the clip space refers to a specific coordinate system within a range so anything out of range will be clipped, and finally the view space that corresponds to the camera point of view.

The object where the texture will be projected for now can be a simple block. In order to get the image in the proper coordinate system is necessary to do some matrix multiplication to go from world space into clip space and finally perspective division is applied. The mathematical representation would be:
```
    [x', y', z', 1] = (1 / w) [x, y, z, w]
```

This can be expanded to include several objects to form a mesh and add some animation to it just to show how the projection works. The animation would be like a slider and is achieved by including a path for every object to follow. So at the end the steps are first to move the mesh to the center, second do the projection transformation and finally put the mesh back at the start.

To cover the image's area properly and guarantee that no object would be too close together the poisson disk sampling algorithm would be used. This will be implemented with a library but the steps for the algorithm basically are:

* Initialize a mutlidimensional grid to store the samples. The cell bounded by ```r/√n``` so each grid cell will have at least one sample.
* Select the first sample randomly and add it to the background grid, then initialize the active list with this sample.
* Finally keep removing from the active list until is empty and generate n points chosen uniformly from the ring between radius ```r``` and ```2r``` 

The perlin noise is used to generate the objects path, which involves three steps. First step is to define a grid with random gradient vectors, the second step is to calculate the dot product between distance gradient vectors and finally interpolation between these values.

For the cursor animation a linear interpolation function would be use to get the repel effect of the objects from the cursor. Most languages include a lerp function so is not necessary to implement this. For projection transformation, poisoon disk sampling algorithm and perlin noise a library called threejs would be used.

[DEMO](https://jaec86.github.io/amt-workshop1/)
