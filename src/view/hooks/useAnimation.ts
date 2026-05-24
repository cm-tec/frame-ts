import { useState, useRef, useEffect, useCallback } from "react";
import Konva from "konva";
import { useAnimationStore } from "../../store/animationStore";

export function useAnimation(speed: number) {
    const [isRunning, setIsRunning] = useState(false);
    const [animKey, setAnimKey] = useState(0);
    const animRef = useRef<Konva.Animation | null>(null);
    const speedRef = useRef(speed);
    useEffect(() => { speedRef.current = speed; }, [speed]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const anim = new Konva.Animation((frame) => {
            if (!frame) return;
            useAnimationStore.setState({ time: speedRef.current * frame.time / 1000 });
        });
        animRef.current = anim;
        return () => { document.body.style.overflow = ''; anim.stop(); };
    }, [animKey]);

    useEffect(() => {
        if (!animRef.current) return;
        if (isRunning) animRef.current.start(); else animRef.current.stop();
    }, [isRunning]);

    const restart = useCallback(() => {
        useAnimationStore.setState({ time: 0 });
        setIsRunning(false);
        setAnimKey(k => k + 1);
    }, []);

    return { isRunning, setIsRunning, restart };
}
