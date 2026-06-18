const payload = [
  {
    "data": [
      [
        "Customer Code", "Customer", "Phone Number", "Address", "Area", "Pin Code", "GST"
      ],
      [
        "CUST0001", "A One Traders Test Remote", "9876543210", "123 Main St", "Friday", "673001", "32ABCDE1234F1Z1"
      ]
    ],
    "name": "Customers"
  }
];

async function run() {
    try {
        console.log("Sending request to remote Zenith API...");
        const res = await fetch('https://zenith-dealers-meet-helper.onrender.com/api/Customers/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        console.log("Response status:", res.status);
        const data = await res.json();
        console.log("Response body:", data);
    } catch (err) {
        console.error("Request failed:", err.message);
    }
}

run();
