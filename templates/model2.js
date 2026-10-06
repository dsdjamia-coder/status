export const model2 = {
  id: 'model_2',
  title: 'Vibrant Teal & Sky Cyber',
  photoX: 240,
  photoY: 200,
  photoWidth: 600,
  photoHeight: 520,
  photoShape: 'rounded', // Options: square, rounded, circle, hexagon
  textStartX: 140,
  textY: 820,
  fontSize: 52,
  fontFamily: "'Noto Kufi Arabic', 'Noto Sans Malayalam', 'Poppins', sans-serif",
  textColor: "#ffffff",
  boxColor: "#0ea5e9", // Sky Blue
  boxPaddingX: 45,
  boxHeight: 105,
  boxRadius: 12,
  drawBackground(ctx, width, height) {
    // Vibrant Teal & Cyber Forest Green Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0d9488'); 
    grad.addColorStop(1, '#064e3b'); 
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Glowing Sky Blue Grid details
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i += 70) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // Modern glowing sky blue cyber border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, width - 40, height - 40);
  },
  drawForeground(ctx, width, height, titleText) {
    // Cyber header container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(120, 60, width - 240, 70);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(120, 60, width - 240, 70);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 30px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText.toUpperCase(), width / 2, 95);
  }
};
