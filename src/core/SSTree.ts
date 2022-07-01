const minPoints = 2;
const maxPoints = 3;

export const equalArrays = <T, >(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
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

    static delete(node: SSNode, target: number[]): any {
        if (node.leaf) {
            const findNode = node.points.find((point) => equalArrays<number>(point, target));
            if (findNode) {
                node.points = node.points.filter((point) => !equalArrays<number>(point, target));
                node.updateBoundingEnvelope();
                return [true, node.points.length < minPoints];
            }
            return [false, false];
        }
        let nodeToFix = null;
        let deleted = false;
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            if (child.intersectsPoint(target)) {
                const [deletedChild, deletedChildNeedsFixing] = SSNode.delete(child, target);
                deleted = deletedChild;
                if (deletedChildNeedsFixing) {
                    nodeToFix = child;
                }
                if (deleted) {
                    break;
                }
            }
        }
        if (nodeToFix === null) {
            if (deleted) {
                node.updateBoundingEnvelope();
            }
            return [deleted, false];
        }
        const siblings = node.siblingsToBorrowFrom(nodeToFix);
        if (siblings.length !== 0) {
            nodeToFix.borrowFromSibling(siblings);
        } else {
            node.mergeChildren(nodeToFix, node.findSiblingToMergeTo(nodeToFix));
        }
        node.updateBoundingEnvelope();
        return [true, node.children.length < minPoints];
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

    private siblingsToBorrowFrom(nodeToFix: SSNode): SSNode[] {
        const siblings = this.children.filter((child) => child !== nodeToFix);
        return siblings.filter((child) => child.children.length > minPoints || child.points.length > minPoints);
    }

    private borrowFromSibling(siblings: SSNode[]) {
        const [closestEntry, closestSibling] = SSNode.findClosestEntryInNodesList(siblings, this);
        SSNode.deleteEntry(closestSibling, closestEntry);
        closestSibling.updateBoundingEnvelope();
        SSNode.addEntry(this, closestEntry);
        this.updateBoundingEnvelope();
    }

    static addEntry(node: SSNode, entry: SSNode | number[]) {
        if (entry instanceof SSNode) {
            node.children.push(entry);
            return;
        }
        node.points.push(entry);
    }

    static deleteEntry(node: SSNode, entry: SSNode | number[]) {
        if (entry instanceof SSNode) {
            node.children = node.children.filter((child) => child !== entry);
            return;
        }
        node.points = node.points.filter((point) => !equalArrays<number>(point, entry));
    }

    static findClosestEntryInNodesList(nodes: SSNode[], target: SSNode): [SSNode | number[], SSNode] {
        let closestEntry: number[] | SSNode | null = null;
        let closestNode: SSNode | null = null;

        nodes.forEach((node) => {
            const closestEntryInNode = node.getClosestCentroidTo(target);
            if (SSNode.closerThan(closestEntryInNode, closestEntry, target)) {
                closestEntry = closestEntryInNode;
                closestNode = node;
            }
        });

        return [closestEntry as unknown as (SSNode | number[]), closestNode as unknown as SSNode];
    }

    static closerThan(node1: SSNode, node2: number[] | SSNode | null, target: SSNode) {
        if (node2 === null) return true;
        if (node2 instanceof SSNode) {
            const distance1 = SSNode.distance(node1.centroid, target.centroid);
            const distance2 = SSNode.distance(node2.centroid, target.centroid);
            return distance1 < distance2;
        } else {
            const distance1 = SSNode.distance(node1.centroid, target.centroid);
            const distance2 = SSNode.distance(node2, target.centroid);
            return distance1 < distance2;
        }
    }

    private getClosestCentroidTo(target: SSNode): SSNode {
        // from this node, get the entry which is closest to target. Entry
        // means a point in a leaf and a node in an internal node
        if (this.leaf) {
            let closestEntryInNode = null;
            let closestDistance = Number.POSITIVE_INFINITY;
            this.points.forEach((entry) => {
                const distance = SSNode.distance(entry, target.centroid);
                if (distance < closestDistance) {
                    closestEntryInNode = entry;
                    closestDistance = distance;
                }
            });
            return closestEntryInNode as unknown as SSNode;
        } else {
            let closestNodeInNode = null;
            let closestDistance = Number.POSITIVE_INFINITY;
            this.children.forEach((node) => {
                const distance = SSNode.distance(node.centroid, target.centroid);
                if (distance < closestDistance) {
                    closestNodeInNode = node;
                    closestDistance = distance;
                }
            });
            return closestNodeInNode as unknown as SSNode;
        }
    }

    private findSiblingToMergeTo(nodeToFix: SSNode): SSNode | null {
        // this is the parent of nodeToFix
        // find the sibling which children plus nodeToFix's children is less or equal to maxChildren
        const candidates_siblings: SSNode[] = [];
        this.children.forEach((child) => {
            if (child === nodeToFix) return;
            if (child.children.length + nodeToFix.children.length <= maxPoints)
                candidates_siblings.push(child);
        });

        if (candidates_siblings.length === 0) {
            return null;
        }
        // return the candidate whose centroid is closest to nodeToFix
        candidates_siblings.sort((a, b) => {
            const distanceA = SSNode.distance(a.centroid, nodeToFix.centroid);
            const distanceB = SSNode.distance(b.centroid, nodeToFix.centroid);
            return distanceA - distanceB;
        });
        return candidates_siblings[0];
    }

    private mergeChildren(firstChild: SSNode, secondChild: SSNode | null) {
        if (firstChild === undefined) {
            throw new Error("firstChild is undefined");
        }
        if (secondChild === null) return;

        const newChild = SSNode.merge(firstChild, secondChild);
        this.children = this.children.filter((child) => child !== firstChild);
        this.children = this.children.filter((child) => child !== secondChild);
        newChild.updateBoundingEnvelope();
        // if (this.children.length === 0) {
        //     this.leaf = true;
        //     this.points = this.points.concat(newChild.points);
        // } else {
        this.children.push(newChild);
        // }
        this.updateBoundingEnvelope();
    }

    private static merge(firstNode: SSNode, secondNode: SSNode): SSNode {
        if (firstNode.leaf !== secondNode.leaf) {
            throw new Error("Can't merge leaf and internal node");
        }

        if (firstNode.leaf) {
            return new SSNode(firstNode.dimension, [], firstNode.points.concat(secondNode.points), true);
        } else {
            return new SSNode(firstNode.dimension, firstNode.children.concat(secondNode.children), [], false);
        }
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

    delete(point: number[]) {
        SSNode.delete(this.root, point);

        if (this.root.children.length === 1) {
            this.root = this.root.children[0];
        }
    }

    dfs(): [SSNode[], number[][]] {
        const nodes: SSNode[] = [];
        const points: number[][] = [];
        SSNode.dfs(this.root, nodes, points);
        return [nodes, points];
    }
}
