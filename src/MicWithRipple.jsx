import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";

const Ripple = () => {
  return (
    <motion.div
      className="absolute w-32 h-32 border-4 border-blue-400 rounded-full"
      initial={{ opacity: 0.6, scale: 1 }}
      animate={{ opacity: 0, scale: 2 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    />
  );
};

const MicWithRipple = () => {
  const [listening, setListening] = useState(false);
  const [ripples, setRipples] = useState([]);
  const rippleRef = useRef(0);

  useEffect(() => {
    let interval;
    if (listening) {
      interval = setInterval(() => {
        setRipples((prev) => [...prev, rippleRef.current++]);
        setTimeout(() => {
          setRipples((prev) => prev.slice(1));
        }, 1000);
      }, 400);
    } else {
      setRipples([]);
      rippleRef.current = 0;
    }

    return () => clearInterval(interval);
  }, [listening]);

  const toggleMic = () => {
    setListening((prev) => !prev);
  };

  return (
    <div className="relative w-32 h-32">
      <AnimatePresence>
        {listening &&
          ripples.map((ripple) => <Ripple key={ripple} />)}
      </AnimatePresence>

      <button
        onClick={toggleMic}
        className={`w-32 h-32 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-xl transition duration-300 ${
          listening ? "scale-110" : ""
        }`}
      >
        <Mic className="w-10 h-10" />
      </button>
    </div>
  );
};

export default MicWithRipple;
