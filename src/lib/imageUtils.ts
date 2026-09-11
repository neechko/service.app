import imageCompression from 'browser-image-compression'

/**
 * Mengompres file gambar sebelum diupload.
 * Target: Maksimal 1MB, resolusi maksimal 1920px, format JPEG.
 */
export async function compressImage(file: File): Promise<File> {
  // Jika file sudah sangat kecil (misal < 500KB), lewati kompresi untuk menghemat waktu
  if (file.size < 500 * 1024) {
    return file
  }

  const options = {
    maxSizeMB: 1, // Maksimal ukuran 1 MB
    maxWidthOrHeight: 1920, // Maksimal resolusi (cukup untuk tampilan web/mobile)
    useWebWorker: true, // Gunakan Web Worker agar tidak membekukan UI browser
    fileType: 'image/jpeg', // Paksa konversi ke JPEG (lebih kecil dari PNG)
  }

  try {
    const compressedFile = await imageCompression(file, options)
    
    // Pastikan ekstensi file berubah menjadi .jpg
    const originalName = file.name.replace(/\.[^/.]+$/, "")
    const newFile = new File([compressedFile], `${originalName}.jpg`, {
      type: 'image/jpeg',
    })
    
    return newFile
  } catch (error) {
    console.error('Gagal mengompres gambar, menggunakan file asli:', error)
    return file // Fallback ke file asli jika kompresi gagal
  }
}