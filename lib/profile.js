export function getInitials(name) {
  return (
    name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export async function compressProfileImage(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSide = 320;
        const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing is not available."));
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = () => reject(new Error("Failed to read the selected image."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Failed to load the selected image."));
    reader.readAsDataURL(file);
  });
}
