
class Point {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}



class Node {
    // Geometry
    point: Point;

    // Material
    mass: number;

    constructor(x: number, y: number, mass: number) {
        this.point = new Point(x, y);

        this.mass = mass;
    }
}



class Element {
    // Geometry
    point_a: Point;
    point_b: Point;

    // Material
    d_mass: number;

    constructor(x_a: number, y_a: number, x_b: number, y_b: number, d_mass: number) {
        this.point_a = new Point(x_a, y_a);
        this.point_b = new Point(x_b, y_b);

        this.d_mass = d_mass;
    }
}


class System {
    nodes: Node[];
    elements: Element[];

    constructor(nodes: Node[], elements: Element[]) {
        this.nodes = nodes;
        this.elements = elements;
    }

    min_x(): number {
        let min: number = Number.MAX_VALUE;

        for (let node of this.nodes) {
            if (node.point.x < min) {
                min = node.point.x
            }
        }

        for (let element of this.elements) {
            if (element.point_a.x < min) {
                min = element.point_a.x
            }

            if (element.point_b.x < min) {
                min = element.point_b.x
            }
        }

        return min;
    }

    min_y(): number {
        let min: number = Number.MAX_VALUE;

        for (let node of this.nodes) {
            if (node.point.y < min) {
                min = node.point.y
            }
        }

        for (let element of this.elements) {
            if (element.point_a.y < min) {
                min = element.point_a.y
            }

            if (element.point_b.y < min) {
                min = element.point_b.y
            }
        }

        return min;
    }

    width(): number {
        let min: number = Number.MAX_VALUE;
        let max: number = -Number.MAX_VALUE;

        for (let node of this.nodes) {
            if (node.point.x < min) {
                min = node.point.x
            }
            if (node.point.x > max) {
                max = node.point.x
            }
        }

        for (let element of this.elements) {
            if (element.point_a.x < min) {
                min = element.point_a.x
            }
            if (element.point_a.x > max) {
                max = element.point_a.x
            }

            if (element.point_b.x < min) {
                min = element.point_b.x
            }
            if (element.point_b.x > max) {
                max = element.point_b.x
            }
        }

        return max - min;
    }


    height(): number {
        let min: number = Number.MAX_VALUE;
        let max: number = -Number.MAX_VALUE;

        for (let node of this.nodes) {
            if (node.point.y < min) {
                min = node.point.y
            }
            if (node.point.y > max) {
                max = node.point.y
            }
        }

        for (let element of this.elements) {
            if (element.point_a.y < min) {
                min = element.point_a.y
            }
            if (element.point_a.y > max) {
                max = element.point_a.y
            }

            if (element.point_b.y < min) {
                min = element.point_b.y
            }
            if (element.point_b.y > max) {
                max = element.point_b.y
            }
        }

        return max - min;
    }
}

export const bernoulli_beam: System = new System(
    [
        new Node(0.5, 0.5, 1),
    ],
    [
        new Element(0.2, 0, 1, 0, 0),
        new Element(0.2, 1, 1, 1, 0),
        new Element(0, 0, 1, 1, 0)
    ]
);