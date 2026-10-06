export const model1 = {
  id: 'model_1',
  title: 'Emerald & Sky Crystal',
  photoX: 290,
  photoY: 180,
  photoWidth: 500,
  photoHeight: 500,
  photoShape: 'circle', // Options: square, rounded, circle, hexagon
  textStartX: 190,
  textY: 780,
  fontSize: 48,
  fontFamily: "'Noto Kufi Arabic', 'Noto Sans Malayalam', 'Poppins', sans-serif",
  textColor: "#ffffff",
  boxColor: "#0ea5e9", // Sky Blue
  boxPaddingX: 50,
  boxHeight: 100,
  boxRadius: 20,
  drawBackground(ctx, width, height) {
    // Beautiful Emerald & Forest Green Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#064e3b'); 
    grad.addColorStop(1, '#022c22'); 
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    
    // Abstract sky blue ray lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 4;
    for (let i = -width; i < width * 2; i += 150) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
    }

    // Heavy Premium Sky Blue Borders
    ctx.strokeStyle = '#0284c7'; 
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    ctx.strokeStyle = '#38bdf8'; 
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, width - 64, height - 64);
  },
  drawForeground(ctx, width, height, titleText) {
    // Beautiful Header Badge in Sky Blue and Dark Green Text
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(120, 60, width - 240, 70);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(124, 64, width - 248, 62);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText.toUpperCase(), width / 2, 95);
  }
};
