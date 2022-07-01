import {MouseEvent, useEffect, useRef, useState} from 'react';
import './App.css';
import Two from 'two.js';
import SSTree from "./core/SSTree";

const getColor = () =>
    "hsl(" + 360 * Math.random() + ',' +
    (25 + 70 * Math.random()) + '%,' +
    (85 + 10 * Math.random()) + '%)'


const drawSSTree = (two: Two, ssTree: SSTree) => {
    two.clear();
    // make circle transparent, only draw the outline
    const [nodes, points] = ssTree.dfs();

    nodes.forEach((node) => {
        if (node === ssTree.root) return;
        const circle = two.makeCircle(node.centroid[0], node.centroid[1], node.radius);
        circle.fill = 'transparent';
        circle.stroke = getColor();
    });
    points.forEach((point) => {
        two.makeCircle(point[0], point[1], 3).fill = '#ff0000';
    });
    two.update();
}


const App = () => {
    const domElement = useRef<HTMLDivElement>(null);
    const currentSSTree = useRef<SSTree>(null);
    const two = useRef(new Two({
        fullscreen: true,
        autostart: true
    }));
    const [dummyState, setDummyState] = useState(0);

    const onClickCanvas = (e: MouseEvent<HTMLDivElement>) => {
        // get the mouse position
        let rect = e.currentTarget.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;


        if (currentSSTree.current === null) {
            // @ts-ignore
            currentSSTree.current = new SSTree(2, [x, y]);
            setDummyState(dummyState + 1);
        } else {
            const dfs = currentSSTree.current!.dfs();
            const points = dfs[1];

            // check if the click is inside any of the nodes with a tolerance of +- 5
            const pointsAlreadyAdded: number[][] = [];
            points.forEach((point) => {
                if (Math.abs(point[0] - x) < 10 && Math.abs(point[1] - y) < 10) {
                    pointsAlreadyAdded.push(point);
                }
            });
            if (pointsAlreadyAdded.length === 0) {
                currentSSTree.current.insert([x, y]);
                setDummyState(dummyState + 1);
            }
            else {
                // remove the point from the tree
                currentSSTree.current.delete(pointsAlreadyAdded[0]);
                setDummyState(dummyState + 1);
            }
        }
    }

    useEffect(setup, []);
    useEffect(() => {
        if (currentSSTree.current === null) {
            return;
        }
        drawSSTree(two.current, currentSSTree.current!);
    }, [dummyState]);

    function setup() {
        two.current.appendTo(domElement.current!);
        return unmount;

        function unmount() {
            two.current.pause();
            domElement.current!.removeChild(two.current.renderer.domElement);
        }
    }

    return <div ref={domElement} onClick={onClickCanvas}/>;
}

export default App;