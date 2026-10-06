export const model3 = {
  id: 'model_3',
  title: 'Jade Mint & Sky Breeze',
  photoX: 290,
  photoY: 220,
  photoWidth: 500,
  photoHeight: 480,
  photoShape: 'hexagon', // Options: square, rounded, circle, hexagon
  textStartX: 190,
  textY: 800,
  fontSize: 46,
  fontFamily: "'Noto Kufi Arabic', 'Noto Sans Malayalam', 'Poppins', sans-serif",
  textColor: "#0369a1", // Dark Sky Blue
  boxColor: "#e0f2fe", // Pastel Sky Blue
  boxPaddingX: 40,
  boxHeight: 90,
  boxRadius: 45,
  drawBackground(ctx, width, height) {
    // Beautiful Jade Green to Sky Blue gradient blend
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#065f46'); 
    grad.addColorStop(0.5, '#0f766e'); 
    grad.addColorStop(1, '#0284c7'); 
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative solar rings
    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.beginPath(); ctx.arc(width/2, height/2, 450, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(width/2, height/2, 350, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, width - 40, height - 40);
  },
  drawForeground(ctx, width, height, titleText) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px "Poppins", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 12;
    ctx.fillText(titleText.toUpperCase(), width / 2, 95);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
};
