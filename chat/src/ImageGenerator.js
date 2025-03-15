import React, { useState } from 'react';

function ImageGenerator() {
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const generateImage = () => {
    if (!description) {
      alert('Please enter a description!');
      return;
    }

    // Pollinations AI API URL
    const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(description)}`;
    setImageUrl(apiUrl); // Directly use the generated URL
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>Generate an Image</h2>
      
      <textarea
        placeholder="Describe the image you want (e.g., 'A futuristic city at sunset')"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          width: '100%',
          height: '100px',
          marginBottom: '10px',
          padding: '10px',
          fontSize: '16px',
        }}
      />
      
      <br />
      
      <button
        onClick={generateImage}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007BFF',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Generate Image
      </button>
      
      {imageUrl && (
        <div style={{ marginTop: '20px' }}>
          <h3>Your Generated Image</h3>
          <img
            src={imageUrl}
            alt="Generated"
            style={{ maxWidth: '100%', borderRadius: '10px' }}
          />
          <br />
          <a href={imageUrl} download="generated_image.png" style={{ marginTop: '10px', display: 'inline-block' }}>
            Download Image
          </a>
        </div>
      )}
    </div>
  );
}

export default ImageGenerator;
