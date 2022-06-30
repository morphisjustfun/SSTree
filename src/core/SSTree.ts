const minPoints = 2;
const maxPoints = 3;

export const equalArrays = <T, >(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;
    a.forEach((item, index) => {
        if (item !== b[index]) return false;
    });
    return true;
}

const minkowskiDistance = (a: number[], b: number[], degree: number): number => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.pow(Math.abs(a[i] - b[i]), degree);
    }
    return Math.pow(sum, 1 / degree);
}

function mean(numbers: number[]) {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function varianceAlongDirection(centroids: number[][], dimension: number) {
    const meanCurrent = mean(centroids.map((centroid) => centroid[dimension]));
    const variance = centroids.map((centroid) => Math.pow(centroid[dimension] - meanCurrent, 2)).reduce((a, b) => a + b, 0);
    return variance / centroids.length;
}

function variance(numbers: number[]) {
    const meanCurrent = mean(numbers);
    const variance = numbers.map((number) => Math.pow(number - meanCurrent, 2)).reduce((a, b) => a + b, 0);
    return variance / numbers.length;
}

function minVarianceSplit(points: number[]) {
    let minVariance = Number.POSITIVE_INFINITY;
    let splitIndex = minPoints;

    for (let i = minPoints; i <= points.length - minPoints; i++) {
        const variance1 = variance(points.slice(0, i));
        const variance2 = variance(points.slice(i));
        if (variance1 + variance2 < minVariance) {
            minVariance = variance1 + variance2;
            splitIndex = i;
        }
    }
    return splitIndex;
}

// point is like [3,4,9] == [x,y,z]
class SSNode {
    dimension: number;

    // change distance used in SSNode
    static distance(a: number[], b: number[]): number {
        return minkowskiDistance(a, b, 2);
    }

    // this will be updated by the updateBoundingEnvelope() method
    centroid: number[] = [];
    radius: number = 0;

    children: SSNode[]; // only used for internal nodes
    points: number[][]; // only used for leaf nodes
    leaf: boolean;

    constructor(dimension: number, children: SSNode[], points: number[][], leaf: boolean) {
        this.dimension = dimension;
        this.children = children;
        this.points = points;
        this.leaf = leaf;
    }

    static search(node: SSNode, target: number[]): SSNode | undefined {
        if (node.leaf) {
            node.points.forEach((point) => {
                if (equalArrays<number>(point, target)) {
                    return node;
                }
            })
            return;
        }
        node.children.forEach((childNode) => {
            if (childNode.intersectsPoint(target)) {
                const result = SSNode.search(childNode, target);
                if (result) return result;
            }
        });
        return;
    }

    static searchParentLeaf(node: SSNode, target: number[]): SSNode | undefined {
        if (node.leaf) {
            return node;
        }
        const child = node.findClosestChild(target);
        return SSNode.searchParentLeaf(child, target);
    }

    static insert(node: SSNode, point: number[]): any {
        if (node.leaf) {
            node.points.forEach((p) => {
                if (equalArrays<number>(p, point)) return;
            });
            node.points.push(point);
            node.updateBoundingEnvelope();
            if (node.points.length <= maxPoints) return;
        } else {
            const closestChild = node.findClosestChild(point);
            const insertResult = SSNode.insert(closestChild, point);
            if (insertResult === undefined) {
                node.updateBoundingEnvelope();
                return;
            } else {
                const [newChild1, newChild2] = insertResult;
                node.children = node.children.filter((child) => child !== closestChild);
                node.children.push(newChild1);
                node.children.push(newChild2);
                node.updateBoundingEnvelope();
                if (node.children.length <= maxPoints) return;
            }
        }
        return node.split();
    }

    private intersectsPoint(target: number[]): boolean {
        return SSNode.distance(this.centroid, target) <= this.radius;
    }

    private findClosestChild(target: number[]): SSNode {
        if (this.leaf) {
            throw new Error("Cannot find closest child of leaf node");
        }
        let minDistance = Number.POSITIVE_INFINITY;
        let result: SSNode | null = null;

        this.children.forEach((child) => {
            const distance = SSNode.distance(child.centroid, target);
            if (distance < minDistance) {
                minDistance = distance;
                result = child;
            }
        });
        return result as unknown as SSNode;
    }

    public updateBoundingEnvelope() {
        const pointsAndNodes: (number[] | SSNode)[] = [];

        if (this.leaf) {
            this.points.forEach((point) => {
                pointsAndNodes.push(point);
            });
        } else {
            this.children.forEach((child) => {
                pointsAndNodes.push(child);
            });
        }

        for (let i = 0; i < this.dimension; i++) {
            this.centroid[i] = mean(pointsAndNodes.map((item) => {
                if (item instanceof SSNode) {
                    return item.centroid[i];
                } else {
                    return item[i];
                }
            }));
        }

        this.radius = Math.max(...pointsAndNodes.map((item) => {
            if (item instanceof SSNode) {
                return SSNode.distance(this.centroid, item.centroid) + item.radius;
            } else {
                return SSNode.distance(this.centroid, item);
            }
        }));
    }

    private split() {
        const splitIndex = this.findSplitIndex();
        if (this.leaf) {
            const newNode1 = new SSNode(this.dimension, [], this.points.slice(0, splitIndex), true);
            const newNode2 = new SSNode(this.dimension, [], this.points.slice(splitIndex), true);
            newNode1.updateBoundingEnvelope();
            newNode2.updateBoundingEnvelope();
            return [newNode1, newNode2];
        }
        const newNode1 = new SSNode(this.dimension, this.children.slice(0, splitIndex), [], false);
        const newNode2 = new SSNode(this.dimension, this.children.slice(splitIndex), [], false);
        newNode1.updateBoundingEnvelope();
        newNode2.updateBoundingEnvelope();
        return [newNode1, newNode2];
    }

    private findSplitIndex() {
        const coordinateIndex = this.directionOfMaxVariance();
        if (this.leaf) {
            this.points.sort((a, b) => a[coordinateIndex] - b[coordinateIndex]);
        } else {
            this.children.sort((a, b) => a.centroid[coordinateIndex] - b.centroid[coordinateIndex]);
        }

        const points: number[] = [];
        if (this.leaf) {
            points.push(...this.points.map((point) => point[coordinateIndex]));
        } else {
            points.push(...this.children.map((child) => child.centroid[coordinateIndex]));
        }
        return minVarianceSplit(points);
    }

    private directionOfMaxVariance() {
        let maxVariance = 0;
        let directionIndex = 0;
        const centroids: number[][] = [];

        if (this.leaf) {
            this.points.forEach((point) => {
                centroids.push(point);
            });
        } else {
            this.children.forEach((child) => {
                centroids.push(child.centroid);
            });
        }

        for (let i = 0; i < this.dimension; i++) {
            const currentVarianceAlongDirection = varianceAlongDirection(centroids, i);
            if (currentVarianceAlongDirection > maxVariance) {
                maxVariance = currentVarianceAlongDirection;
                directionIndex = i;
            }
        }
        return directionIndex;
    }

    static dfs(node: SSNode, nodes: SSNode[], points: number[][]): void {
        nodes.push(node);
        if (node.leaf) {
            points.push(...node.points);
            return;
        }
        node.children.forEach((child) => {
            SSNode.dfs(child, nodes, points);
        });
    }
}


export default class SSTree {
    dimension: number;
    root: SSNode;

    constructor(dimension: number, point: number[]) {
        this.dimension = dimension;
        this.root = new SSNode(dimension, [], [point], true);
        this.root.updateBoundingEnvelope();
    }

    search(target: number[]) {
        return SSNode.search(this.root, target);
    }

    insert(point: number[]) {
        const insertResult = SSNode.insert(this.root, point);
        if (insertResult !== undefined) {
            const [newChild1, newChild2] = insertResult;
            this.root = new SSNode(this.dimension, [newChild1, newChild2], [], false);
            this.root.updateBoundingEnvelope();
        }
    }

    dfs(): [SSNode[], number[][]] {
        const nodes: SSNode[] = [];
        const points: number[][] = [];
        SSNode.dfs(this.root, nodes, points);
        return [nodes, points];
    }
}
