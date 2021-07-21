////////////////////////////////////////////////////////////////////////////////
// Test Data
////////////////////////////////////////////////////////////////////////////////


let goal =
    { ctx : [],
      dims: ["i", "j", "k"],
      bdry: [
          { pred: ["eq", "j", "dim0"], cons: "p 0" },
          { pred: ["eq", "j", "dim1"], cons: "r 1" },
          { pred: ["eq", "i", "dim0"], cons: "trans {trans p q} r j" },
          { pred: ["eq", "i", "dim1"], cons: "trans p {trans q r} j" },
      ],
    }

////////////////////////////////////////////////////////////////////////////////
// Goal Parsing
////////////////////////////////////////////////////////////////////////////////


// [NOTE: Boundary Constraints]
// A boundary constraint label is represented by an array [lbl, i, j, k, ...]
// in n-dimensions. Furthermore, i=0 is represented by using -1 in the dimensions slot,
// and leaving a dimension unspecified is represented by filling in the label with 0.
// For instance, 'i, j, k |- i = 0 /\ k = 1 => tm' is represented by [tm, -1, 0, 1]
// TODO: Make sure that 'cooltt' only sends over boundary constraints in disjunctive normal form.

function addEqConstraint(dims, coords, i, j) {
    let dim_idx = dims.findIndex(dim => dim === i)
    // FIXME: What about '0 = i'
    if(j === "dim0") {
        coords[dim_idx] = -1;
    } else if (j === "dim1") {
        coords[dim_idx] = 1;
    } else {
        // FIXME: What about diagonals?
        throw("ERROR: Dimension " + j + " not supported.")
    }
}

function addBoundaryConstraints(dims, coords, bdry) {
    let cof_type = bdry[0]

    if(cof_type === "eq") {
        addEqConstraint(dims, coords, bdry[1], bdry[2])
    } else if (cof_type === "join") {
        // FIXME: What about the outer 'cof' ctor??
        for(i = 1; i < bdry.pred.length; i++) {
            addBoundaryConstraint(dims, coords, bdry[i])
        }
    } else {
        throw("ERROR: Cofibration " + cof_type + " not supported.")
    }
}

function boundaryConstraints(dims, bdry) {
    let constraints = []
    for (i = 0; i < bdry.length; i++) {
        let coords = Array(dims.length).fill(0);
        let b = bdry[i];
        addBoundaryConstraints(dims, coords, b.pred)
        constraints.push({label: b.cons, coords : coords})
    }
    return constraints
}

////////////////////////////////////////////////////////////////////////////////
// Hypercubes
////////////////////////////////////////////////////////////////////////////////

// [NOTE: Hypercube Geometry]
// Rather than trying to make a really fancy geometry here, we
// are going to try an just build up a really dumb hypercube then
// do most of our work when we actually project the darn thing down.

// Project down a single dimension
function project1(v) {
    let view_angle = Math.PI / 4
    let t = (Math.tan(view_angle/2))

    let proj = v[v.length - 1] + 3;

    let r = []
    for(let i = 0; i < v.length - 1; i++) {
        r.push((t  * v[i]) / proj)
    }
    return r
}

function scale(v, r) {
    return v.map((x) => x * r)
}

// Project down into 3 dimensions
function project(v) {
    // As we go higher and higher in dimension, things get smaller
    // and smaller due to huge exponents. Therefore, we scale the points
    // up after the projection
    let s = 2 ** (v.length - 3)
    let r = v;
    for(let i = 0; i < v.length - 3; i++) {
        // r = scale(project1(r), s)
        r = project1(r)
    }
    return r
}

// So what we want to do here is build quads for each of the faces.
// This is a bit hard though, as three-js makes building quads harder
// then it ought to be. As we don't need to apply textures,
// we can ignore UV coordinates.

function choose(n, k) {
    let r = 1
    for(let i = 1; i <= k; i++) {
        r *= (n + 1 - i)/i;
    }
    return r
}

// The number of k-faces in an n-cube
function num_faces(n, k) {
    return (2 ** (n - k)) * choose(n, k)
}


// Generate the set of combinations of size k from {0...n-1}
function combinations(n, k) {
  const result= [];
  const combos = [];
  const go = start => {
    if (combos.length + (n - 1 - start + 1) < k) { return }
    go(start + 1);
    combos.push(start);
    if(combos.length === k) {
       result.push(combos.slice());
    }else if(combos.length + (n - 1 - start + 2) >= k){
       go(start + 1);
    }
    combos.pop();
  }
  go(0, combos);
  return result;
}

// Given an integer i, generate a bit-pattern of length n.
function points(n, i, r) {
    let bits = Array.from((i).toString(2).padStart(n, "0"))
    // We want our cube to be cenetered at 0, so we need to
    // turn any '0's into '-r's
    return bits.map((x) => x === "0" ? -r : r)
}

// Generate all of the vertices of the n-cube.
// This makes sure that all of the vertices are set
// up nicely for when we actually render triangles.
function hypercube_vertices(n, r) {
    let vertices = []
    // To build a 2-face for an n-cube, we will need to pick
    // 2 sets of dimensions to vary.
    let free_dims = combinations(n, 2)
    for(let i = 0; i < free_dims.length; i++) {
        let free = free_dims[i]
        // Now that we know what 2 dimensions, we will vary to make the 2-face,
        // we need to pick where on the cube this 2-face will live. For instance,
        // on a 3-cube, if we vary the 'x' and 'y' dimensions, we need to create
        // faces when 'z' is 0 AND 1. To generalize to higher dimensions, we need
        // to generate all possible places where the face can live by looking
        // at all the dimensions that do not vary during face construction.
        //
        // To do this cheaply and easily, we will use some bit level-magic by
        // realizing that an integer 'c < 2 ^ n' can represent a vertex on an
        // n-cube by manner of it's binary representation.
        for(let fx = 0; fx < 2**(n - 2); fx++) {
            let bits = points(n - 2, fx, r)

            // Now, we need to splice in the 4 corners of the face.
            // We are using 'bits.slice()' here to perform a shallow copy,
            // as splice is the easiest way to perform an insertion, yet
            // mutates the array.
            let bottom_left = bits.slice()
            bottom_left.splice(free[0], 0, -r)
            bottom_left.splice(free[1], 0, -r)
            let bottom_right = bits.slice()
            bottom_right.splice(free[0], 0, r)
            bottom_right.splice(free[1], 0, -r)
            let top_left = bits.slice()
            top_left.splice(free[0], 0, -r)
            top_left.splice(free[1], 0, r)
            let top_right = bits.slice()
            top_right.splice(free[0], 0, r)
            top_right.splice(free[1], 0, r)
            // let pos = [ bottom_left, bottom_right, top_left, top_right ]

            // For the normal vector, we can just set the two free coordinates
            // to 0 and get the correct orientation.
            let norm = bits.slice()
            norm.splice(free[0], 0, 0)
            norm.splice(free[1], 0, 0)

            vertices.push({pos: bottom_left, norm})
            vertices.push({pos: bottom_right, norm})
            vertices.push({pos: top_left, norm})
            vertices.push({pos: top_right, norm})
        }
    }
    return vertices
}

// When we actually render the faces, we need to
// tell THREE how to actually render the triangles.
// In particular, we will use some vertices /twice/,
// as they are contained in both of the 2 triangles
// that we will use to build our quad. Luckily,
// 'hypercube_vertices' is set up so that this is done
// easily.
function hypercube_indicies(n) {
    let indicies = []
    for(let i = 0; i < num_faces(n,2); i++) {
        let vtx = i*4
        indicies.push(vtx)
        indicies.push(vtx+1)
        indicies.push(vtx+2)
        indicies.push(vtx+2)
        indicies.push(vtx+1)
        indicies.push(vtx+3)
    }
    return indicies
}

// FIXME: Use some OO nonsense here
function 

function hypercube_geometry(n, r) {
    let geometry = new THREE.BufferGeometry()
    let vertices = hypercube_vertices(n, r)
    let indicies = hypercube_indicies(n)

    let positions = []
    let normals = []

    for (let vtx of vertices) {
        positions.push(...project(vtx.pos))
        normals.push(...project(vtx.norm))
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setIndex(indicies)

    return geometry
}


// Generate an n-dimensional hypercube.
function hypercube(n, r) {
    let vertices = []
    for(i = 0; i < 2**n; i++) {
        // Dumb hack to convert an integer to bits
        let bits = Array.from((i).toString(2).padStart(n, "0"))
        // We want our cube to be cenetered at 0, so we need to
        // turn any '0's into '-1's
        let recenter = (x) => x === "0" ? -r : r
        vertices.push(bits.map(recenter))
    }
    return vertices
}

////////////////////////////////////////////////////////////////////////////////
// Rendering
////////////////////////////////////////////////////////////////////////////////


function makeLabel(label) {
    let labelDiv = document.createElement('div')
    labelDiv.className = 'label'
    labelDiv.textContent = label
    labelDiv.style.marginTop = '-1em'
    return new THREE.CSS2DObject(labelDiv)
}

function renderConstraints(cube, constraints) {
    for(i = 0; i < constraints.length; i++) {
        let c = constraints[i]
        let label = makeLabel(c.label)
        cube.add(label)
        // FIXME: This assumes that we are working with a 3d cube
        label.position.set(c.coords[0], c.coords[1], c.coords[2])
    }
}

function renderDot(coords, scene) {
    let dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3 ));
    let dotMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0x000000 }) ;
    let dot = new THREE.Points(dotGeometry, dotMaterial);
    scene.add(dot);
}

function initScene() {
    let canvas = document.getElementById("c")
    canvas.width = document.body.clientWidth
    canvas.height = document.body.clientHeight

    let camera = new THREE.PerspectiveCamera(75, canvas.width/canvas.height, 0.1, 1000)
    let renderer = new THREE.WebGLRenderer({ canvas: canvas })
    let labelRenderer = new THREE.CSS2DRenderer()
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = 0
    labelRenderer.domElement.style.left = 0
    document.body.appendChild(labelRenderer.domElement)
    let scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    // let geometry = new THREE.BoxGeometry(2, 2, 2)
    let geometry = hypercube_geometry(1,2)
    let edges = new THREE.EdgesGeometry(geometry)
    let material = new THREE.MeshBasicMaterial({ color: 0x000000 })

    camera.position.set(0, 0, 3)

    let cube = new THREE.LineSegments(edges, material)
    scene.add(cube)

    // let constraints = boundaryConstraints(goal.dims, goal.bdry)
    // renderConstraints(cube, constraints)

    // let axesHelper = new THREE.AxesHelper(0.5)
    // cube.add(axesHelper)

    // Animation
    let controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
    console.log(renderer.domElement)

    controls.update()

    let animate = () => {
        requestAnimationFrame(animate)
        controls.update()

        labelRenderer.setSize(canvas.width, canvas.height)

        renderer.render(scene, camera)
        labelRenderer.render(scene, camera);

        // cube.rotation.y += 0.01
        // cube.rotation.z += 0.01
    }
    animate()
}


initScene()
