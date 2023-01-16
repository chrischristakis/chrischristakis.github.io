window.addEventListener("load", init); // Run on DOM completion

let gl;
let scale;

function init() {
    const canvas = document.getElementById("glcanvas");

    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;

    gl = canvas.getContext('webgl');

    if(gl === null) {
        canvas.style.backgroundColor = '#1B262C';
        return;
    }

    // OGL enables
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Shader code
    const vsSource = `
        precision mediump float;
        attribute vec3 inVertPos;
        attribute vec3 inVertNormal;
        uniform mat4 model;
        uniform mat4 view;
        uniform mat4 projection;

        varying vec3 normal;
        varying vec3 vertPos;

        void main() {
            // I'm only doing uniform scales, so I'll save myself the inverse/transpose normal matrix
            normal = mat3(model) * inVertNormal;

            vertPos = vec3(model * vec4(inVertPos, 1.0));
            gl_Position = projection * view * model * vec4(inVertPos, 1.0);
        }
    `;
    
    const fsSource = `
        precision mediump float;
        varying vec3 normal;
        varying vec3 vertPos; //Our vertex's position in view space

        uniform vec3 objColor;
        uniform vec3 lightPos;

        void main() {
            float ambientCoefficient = 0.2;
            vec3 ambient = 0.2 * vec3(1, 1, 1);
            float diffuseCoefficient = max(dot(normalize(normal), normalize(-lightPos)), 0.0); 
            vec3 diffuse = diffuseCoefficient * vec3(1, 1, 1);

            vec3 result = objColor * (diffuse + ambient);
            gl_FragColor = vec4(result, 1.0);
        }
    `; 

    const cubeShader = createShaderProgram(vsSource, fsSource);    

    // Our vertex data
    const verts = [   
        // X, Y, Z          // Normal (x, y, z)
		// Top
		-1.0, 1.0, -1.0,     0.0, 1.0, 0.0,
		-1.0, 1.0, 1.0,      0.0, 1.0, 0.0,
		1.0, 1.0, 1.0,       0.0, 1.0, 0.0,
		1.0, 1.0, -1.0,      0.0, 1.0, 0.0,

		// Left
		-1.0, 1.0, 1.0,     -1.0, 0.0, 0.0,
		-1.0, -1.0, 1.0,    -1.0, 0.0, 0.0,
		-1.0, -1.0, -1.0,   -1.0, 0.0, 0.0,
		-1.0, 1.0, -1.0,    -1.0, 0.0, 0.0,

		// Right
		1.0, 1.0, 1.0,       1.0, 0.0, 0.0,
		1.0, -1.0, 1.0,      1.0, 0.0, 0.0,
		1.0, -1.0, -1.0,     1.0, 0.0, 0.0,
		1.0, 1.0, -1.0,      1.0, 0.0, 0.0,

		// Front
		1.0, 1.0, 1.0,       0.0, 0.0, 1.0,
		1.0, -1.0, 1.0,      0.0, 0.0, 1.0,
		-1.0, -1.0, 1.0,     0.0, 0.0, 1.0,
		-1.0, 1.0, 1.0,      0.0, 0.0, 1.0,

		// Back
		1.0, 1.0, -1.0,      0.0, 0.0, -1.0,
		1.0, -1.0, -1.0,     0.0, 0.0, -1.0,
		-1.0, -1.0, -1.0,    0.0, 0.0, -1.0,
		-1.0, 1.0, -1.0,     0.0, 0.0, -1.0,

		// Bottom
		-1.0, -1.0, -1.0,    0.0, -1.0, 0.0,
		-1.0, -1.0, 1.0,     0.0, -1.0, 0.0,
		1.0, -1.0, 1.0,      0.0, -1.0, 0.0,
		1.0, -1.0, -1.0,     0.0, -1.0, 0.0
	];

    const indices = [
        // Top
		0, 1, 2,
		0, 2, 3,

		// Left
		5, 4, 6,
		6, 4, 7,

		// Right
		8, 9, 10,
		8, 10, 11,

		// Front
		13, 12, 14,
		15, 14, 12,

		// Back
		16, 17, 18,
		16, 18, 19,

		// Bottom
		21, 20, 22,
		22, 20, 23
    ]

    // Init VBOs
    let cubeVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

    //...And our EBO
    let cubeEBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeEBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Tell GPU how to read our VBO usig some attrib pointers.
    const vertPosLocation = gl.getAttribLocation(cubeShader, "inVertPos");
    gl.vertexAttribPointer(
        vertPosLocation, 
        3,  // elements per attribute 
        gl.FLOAT, // type
        gl.FALSE, // normalized (webgl requires it to be false)
        6 * Float32Array.BYTES_PER_ELEMENT, // stride
        0  // offset
    );
    gl.enableVertexAttribArray(vertPosLocation);

    const vertNormLocation = gl.getAttribLocation(cubeShader, "inVertNormal");
    gl.vertexAttribPointer(
        vertNormLocation, 
        3,  // elements per attribute 
        gl.FLOAT, // type
        gl.FALSE, // normalized (webgl requires it to be false)
        6 * Float32Array.BYTES_PER_ELEMENT, // stride
        3 * Float32Array.BYTES_PER_ELEMENT  // offset
    );
    gl.enableVertexAttribArray(vertNormLocation);

    // Initialize our matrices and other data used in render loop
    const mat4 = glMatrix.mat4;  // Just a shorthand.
    const identity = mat4.create();

    let model = mat4.create();
    let view = mat4.create(); 
    let projection = mat4.create();

    const objColor = [171/255, 53/255, 45/255];
    const lightPos = [1, -1, 0];

    //Store our uniform locations so they're easy to access (unlikely to change at runtime)
    const uniforms = {
        modelLocation: gl.getUniformLocation(cubeShader, "model"),
        viewLocation: gl.getUniformLocation(cubeShader, "view"),
        projectionLocation: gl.getUniformLocation(cubeShader, "projection"),
        objColor: gl.getUniformLocation(cubeShader, "objColor"),
        lightPos: gl.getUniformLocation(cubeShader, "lightPos")
    }

    // Positions of background cubes. Random looked too messy.
    let positions = [
        [3, -3.5, -4.3],
        [-5, -8, -50],
        [6, 2, -6],
        [-9, -2, -10],
        [-6, 10, -20],
        [2, 5, -3],
        [-17, -15, -40],
        [-35, 18, -50],
        [30, -15, -40],
        [-15, 8, -60],
        [4, 0, -20],
        [5, 10, -80],
        [-1.3, -3.5, 2],
        [-1.7, 0.5, -10],
        [10, 15, -50],
        [40, 25, -60],
        [-13, 3, -10],
        [1, 6, -18],
    ];

    // Randomize the axis each cube spins on and give them a speed
    let cubeInfo = [];
    for(let i = 0; i < positions.length; i++) {
        cubeInfo.push({ 
            position: positions[i], 
            axis: [rand(0, 1), rand(0, 1), rand(0, 1)],
            speed: rand(0.4, 2) * (randBool())? -1 : 1
        });
    }

    //Render loop
    let angle = 0;
    function loop() {
        gl.clearColor(27/255, 38/255, 44/255, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //Set our uniforms (program must be bound!
        gl.useProgram(cubeShader);
        gl.uniformMatrix4fv(uniforms.viewLocation, gl.FALSE, view);
        gl.uniformMatrix4fv(uniforms.projectionLocation, gl.FALSE, projection);
        gl.uniform3fv(uniforms.objColor, objColor);
        gl.uniform3fv(uniforms.lightPos, lightPos);

        //Handle our matrix transforms here
        angle = performance.now() / 4000;
        mat4.translate(view, identity, [0, 0, -9]);
        mat4.perspective(projection, degreesToRad(45), canvas.width/canvas.height, 0.1, 100.0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
        
        for(let i = 0; i < cubeInfo.length; i++) {
            mat4.translate(model, identity, cubeInfo[i].position);
            mat4.rotate(model, model, angle*cubeInfo[i].speed, cubeInfo[i].axis);
            gl.uniformMatrix4fv(uniforms.modelLocation, gl.FALSE, model);

            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

// Compiles a vertex and fragment shader, links the program and returns the program.
function createShaderProgram(vertSource, fragSource) {
    function createShader(shaderType, source) {
        const shader = gl.createShader(shaderType);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(`Cannot compile a shader: ${gl.getShaderInfoLog(shader)}`);
            return null;
        }
        return shader;
    }

    const vertShader = createShader(gl.VERTEX_SHADER, vertSource);
    const fragShader = createShader(gl.FRAGMENT_SHADER, fragSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(`Cannot link a program: ${gl.getProgramInfoLog(program)}`);
        return null;
    }

    return program;
}

function degreesToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function randBool() {
    return Math.random() > 0.5;
}

// RESIZE EVENT
window.addEventListener("resize", () => {
    const canvas = document.getElementById("glcanvas");
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
});