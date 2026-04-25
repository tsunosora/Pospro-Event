"use client";

export function ExindoAnimatedLogo({ size = 360 }: { size?: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1080 1080"
            style={{ width: size, height: size, display: "block", overflow: "visible" }}
        >
            <defs>
                <style>{`
                  .ex-cls-1 { fill: #ed3237; }

                  @keyframes ex-logoPopup {
                    0%   { transform: scale(0) rotate(-8deg);   opacity: 0; }
                    18%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
                    26%  { transform: scale(0.96) rotate(-1deg); opacity: 1; }
                    34%  { transform: scale(1) rotate(0deg);    opacity: 1; }
                    92%  { transform: scale(1) rotate(0deg);    opacity: 1; }
                    100% { transform: scale(1) rotate(0deg);    opacity: 0; }
                  }
                  .ex-logo-mark {
                    transform-origin: 540px 400px;
                    transform-box: view-box;
                    animation: ex-logoPopup 7s cubic-bezier(0.22, 1, 0.36, 1) infinite;
                  }

                  @keyframes ex-letterPop {
                    0%   { transform: translateY(40px) scale(0.6); opacity: 0; }
                    60%  { transform: translateY(-6px) scale(1.06); opacity: 1; }
                    80%  { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                  }
                  .ex-title-text {
                    font-size: 72px;
                    font-family: 'Arial Black', 'Helvetica Neue', Arial, sans-serif;
                    font-weight: 900;
                    fill: #ffffff;
                    text-anchor: middle;
                    letter-spacing: 2px;
                  }
                  .ex-title-letter {
                    opacity: 0;
                    transform-origin: center bottom;
                    transform-box: fill-box;
                    animation: ex-letterPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                  }

                  .ex-tagline-path {
                    fill: none;
                    stroke: #ffffff;
                    stroke-width: 1.8;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 3000;
                    stroke-dashoffset: 3000;
                    font-size: 56px;
                    font-family: 'Arial', 'Helvetica Neue', sans-serif;
                    font-weight: 300;
                    text-anchor: middle;
                    letter-spacing: 1px;
                    animation: ex-writeTagline 7s ease-in-out infinite;
                  }
                  @keyframes ex-writeTagline {
                    0%   { stroke-dashoffset: 3000; opacity: 1; }
                    20%  { stroke-dashoffset: 3000; opacity: 1; }
                    65%  { stroke-dashoffset: 0;    opacity: 1; }
                    90%  { stroke-dashoffset: 0;    opacity: 1; }
                    100% { stroke-dashoffset: 0;    opacity: 0; }
                  }

                  .ex-tagline-fill {
                    font-size: 56px;
                    font-family: 'Arial', 'Helvetica Neue', sans-serif;
                    font-weight: 300;
                    fill: #ffffff;
                    text-anchor: middle;
                    letter-spacing: 1px;
                    opacity: 0;
                    animation: ex-fillTagline 7s ease-in-out infinite;
                  }
                  @keyframes ex-fillTagline {
                    0%, 55% { opacity: 0; }
                    70%     { opacity: 1; }
                    90%     { opacity: 1; }
                    100%    { opacity: 0; }
                  }

                  .ex-accent-line {
                    transform-origin: center center;
                    transform-box: fill-box;
                    transform: scaleX(0);
                    animation: ex-sweepLine 7s cubic-bezier(0.77, 0, 0.175, 1) infinite;
                  }
                  @keyframes ex-sweepLine {
                    0%   { transform: scaleX(0); opacity: 0; }
                    15%  { transform: scaleX(0); opacity: 1; }
                    30%  { transform: scaleX(1); opacity: 1; }
                    90%  { transform: scaleX(1); opacity: 1; }
                    100% { transform: scaleX(1); opacity: 0; }
                  }

                  .ex-scene { animation: ex-sceneFade 7s ease-in-out infinite; }
                  @keyframes ex-sceneFade {
                    0%   { opacity: 0; }
                    5%   { opacity: 1; }
                    95%  { opacity: 1; }
                    100% { opacity: 0; }
                  }

                  .ex-l1  { animation-delay: 0.35s; }
                  .ex-l2  { animation-delay: 0.41s; }
                  .ex-l3  { animation-delay: 0.47s; }
                  .ex-l4  { animation-delay: 0.53s; }
                  .ex-l5  { animation-delay: 0.59s; }
                  .ex-l6  { animation-delay: 0.65s; }
                  .ex-l7  { animation-delay: 0.71s; }
                  .ex-l8  { animation-delay: 0.77s; }
                  .ex-l9  { animation-delay: 0.83s; }
                  .ex-l10 { animation-delay: 0.89s; }
                  .ex-l11 { animation-delay: 0.95s; }
                  .ex-l12 { animation-delay: 1.01s; }
                  .ex-l13 { animation-delay: 1.07s; }
                  .ex-l14 { animation-delay: 1.13s; }
                  .ex-l15 { animation-delay: 1.19s; }
                  .ex-l16 { animation-delay: 1.25s; }
                  .ex-l17 { animation-delay: 1.31s; }
                  .ex-l18 { animation-delay: 1.37s; }
                `}</style>
            </defs>

            <g className="ex-scene">
                <g className="ex-logo-mark">
                    <path
                        className="ex-cls-1"
                        d="M507.74,186.24c1.89-7.66,6.8-14.15,12.71-19.22a7,7,0,0,0,.92,8.55c2,3,5.76,3.7,8.35,6,9.32,7.43,15.83,17.69,21.41,28.08,4.42,8.26,7.94,17,11.63,25.56,11.23-4.07,22.59-8.08,34.42-10,9.76-1.61,20.31.47,28.16,6.67,7.18,5.39,11.61,13.58,14.48,21.93a110.35,110.35,0,0,1,4,15.73q-30.4,6.89-60.52,14.89c12.72,30.5,30.23,58.91,51,84.6q48.15-58.23,96-116.75c15-16.17,31.17-31.35,49.12-44.21,16.06-11.45,33.77-21.07,53.06-25.74a100.06,100.06,0,0,1,22.93-2.8c-1.44,11.21-6.69,21.59-13.32,30.61a128.32,128.32,0,0,1-20.63,21.74c-14,12.12-28,24.13-42,36.29-16.83,17.74-33.52,35.6-49.73,53.92A554.41,554.41,0,0,0,691,372.06c-6.83,10.11-13.45,20.42-18.83,31.39-3,6.52-6.33,13.46-5.47,20.82,1.17,9.34,6.27,17.46,10.72,25.54,5.27,9.38,9.86,19.13,15.1,28.53a453.11,453.11,0,0,0,76.31,101.09,57.31,57.31,0,0,0,4.59,4.37c4.2.13,8.39,0,12.59.07a31.91,31.91,0,0,1,8,19.71c.6,9.08-1.32,18.08-3.88,26.74-1.52,5.54-2.91,11.12-4.23,16.71-19.52-3.34-36.17-16.11-47.93-31.6-10.46-14.42-19.28-29.93-28.5-45.16L634.32,457.51q-3.26,3.6-6.44,7.25a37.34,37.34,0,0,1,9.94,10.86c3.68,5.94,6.91,12.64,6.65,19.8-.21,5.76-3.79,10.83-8.29,14.18-5.75,4.34-12.58,7-19.45,9-10.81,2.33-21.69,4.34-32.55,6.39-6.12,11.08-11.81,22.52-15.43,34.69q-3.5,10.79-7,21.55c-2.07,6.8-4.82,13.6-9.61,19-2.94,3.3-7.08,5.74-11.59,5.77-5.3,0-10.17-2.52-14.48-5.39-3.41-2.39-7.06-4.85-9-8.68-3.27-6.2-3.08-13.54-2-20.28,2.08-12.19,6.89-23.7,12.1-34.83-28.12,6.49-55.78,14.79-83.54,22.65q-42.15,12-84.25,24.09c-11.59,3.2-23,7.12-35,8.76-9.11.35-18.55.06-27.11-3.42a31.39,31.39,0,0,1-18-18.41,32.05,32.05,0,0,1,2.35-25.68c5.15-9.25,13.9-16.08,23.56-20.14,11.59-5.14,24.31-6.37,36.66-8.47q82.49-13.42,164.89-27.24a39.42,39.42,0,0,0,5.26-1c19-7.29,38-14.6,57.09-21.59a2.92,2.92,0,0,0,1.7-1.36c5.42-8.1,10.92-16.15,15.87-24.55,6.47-11.22,10.41-24.12,9.85-37.14-11.48,6.52-23.79,11.44-36.23,15.81-41.3,14.32-84.42,22.27-127.33,30-27.89,8.55-55.8,17.15-84,24.48-14.93,3.68-30.14,7-45.58,7-10-.1-20.69-2-28.37-8.83-5.07-4.38-7.57-10.8-9.71-17-2.22-6.88-3.42-14.81,0-21.5,3.52-6.89,10.58-11,17.55-13.72,10.27-3.84,21.14-5.61,31.92-7.37,12.7-2,25.52-3.2,38.24-5.09,47.93-6.79,95.17-17.5,142.34-28.19,15.07-5.55,30.07-11.3,45.19-16.69,12.18-4.32,24.31-8.92,36.94-11.75C566.22,332,554.53,314,543.85,295.33c-44.78,12.93-89.48,26.14-134.23,39.17-43.77,12.05-87.8,23.3-132.46,31.58-9.46,1.73-19.2,3.76-28.82,2a30,30,0,0,1-20-12.33c-4.48-6.43-5.64-14.38-7.14-21.89-1.32-6.63-.47-14.07,3.83-19.5s10.9-8.24,17.43-9.8c8.81-2,17.82-3,26.79-4a865.24,865.24,0,0,0,93.2-13c48.94-10.93,97.81-22.18,146.7-33.3,4.58-1,9.06-2.41,13.52-3.86-4.6-9.8-9.1-19.7-12.42-30-3.59-10.92-5.9-22.85-2.54-34.14Z"
                    />
                </g>

                <text className="ex-title-text" x="540" y="790">
                    <tspan className="ex-title-letter ex-l1">C</tspan>
                    <tspan className="ex-title-letter ex-l2">V</tspan>
                    <tspan className="ex-title-letter ex-l3">.</tspan>
                    <tspan className="ex-title-letter ex-l4"> </tspan>
                    <tspan className="ex-title-letter ex-l5">E</tspan>
                    <tspan className="ex-title-letter ex-l6">X</tspan>
                    <tspan className="ex-title-letter ex-l7">I</tspan>
                    <tspan className="ex-title-letter ex-l8">N</tspan>
                    <tspan className="ex-title-letter ex-l9">D</tspan>
                    <tspan className="ex-title-letter ex-l10">O</tspan>
                    <tspan className="ex-title-letter ex-l11"> </tspan>
                    <tspan className="ex-title-letter ex-l12">P</tspan>
                    <tspan className="ex-title-letter ex-l13">R</tspan>
                    <tspan className="ex-title-letter ex-l14">A</tspan>
                    <tspan className="ex-title-letter ex-l15">T</tspan>
                    <tspan className="ex-title-letter ex-l16">A</tspan>
                    <tspan className="ex-title-letter ex-l17">M</tspan>
                    <tspan className="ex-title-letter ex-l18">A</tspan>
                </text>

                <rect className="ex-accent-line" x="340" y="815" width="400" height="5" rx="2.5" fill="#ed3237" />

                <text className="ex-tagline-path" x="540" y="895">
                    Exhibition &amp; Interior Builder
                </text>
                <text className="ex-tagline-fill" x="540" y="895">
                    Exhibition &amp; Interior Builder
                </text>
            </g>
        </svg>
    );
}
