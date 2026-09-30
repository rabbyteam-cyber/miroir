// Fonction serveur : crée une session de paiement Stripe à partir du panier envoyé par l'app.
// La clé secrète Stripe (STRIPE_SECRET_KEY) doit être configurée dans Netlify,
// jamais écrite dans ce fichier ni dans le code de l'app.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  var secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "STRIPE_SECRET_KEY n'est pas configurée sur Netlify." })
    };
  }

  var cart;
  try {
    var body = JSON.parse(event.body || '{}');
    cart = body.cart;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Panier invalide.' }) };
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Panier vide.' }) };
  }

  var origin = event.headers.origin || ('https://' + event.headers.host);
  var params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', origin + '/?checkout=success');
  params.append('cancel_url', origin + '/?checkout=cancel');

  cart.forEach(function (item, i) {
    var name = (item && item.name ? String(item.name) : 'Article').slice(0, 200);
    var size = item && item.size ? String(item.size) : '';
    var price = Number(item && item.price) || 0;
    params.append('line_items[' + i + '][price_data][currency]', 'eur');
    params.append('line_items[' + i + '][price_data][product_data][name]', name + (size ? ' (Taille ' + size + ')' : ''));
    params.append('line_items[' + i + '][price_data][unit_amount]', String(Math.round(price * 100)));
    params.append('line_items[' + i + '][quantity]', '1');
  });

  // Frais de livraison fixes, en ligne séparée
  var shippingIndex = cart.length;
  params.append('line_items[' + shippingIndex + '][price_data][currency]', 'eur');
  params.append('line_items[' + shippingIndex + '][price_data][product_data][name]', 'Livraison');
  params.append('line_items[' + shippingIndex + '][price_data][unit_amount]', '490');
  params.append('line_items[' + shippingIndex + '][quantity]', '1');

  try {
    var resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    var data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: (data.error && data.error.message) || 'Erreur Stripe.' })
      };
    }
    return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Erreur serveur.' }) };
  }
};
