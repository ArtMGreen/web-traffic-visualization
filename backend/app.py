from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import deque
import reverse_geocoder as rg
import pycountry

def get_country_from_coords(lat, lon):
    results = rg.search((lat, lon))
    iso_code = results[0]['cc']
    country = pycountry.countries.get(alpha_2=iso_code)
    return country.name if country else iso_code


app = Flask(__name__)
CORS(app, origins=["*"])

queue = deque(maxlen=1000)

@app.route('/api/package', methods=['GET'])
def receive_package():
    data = request.get_json()

    country = get_country_from_coords(data['latitude'], data['longitude'])
    data['country'] = country

    queue.append(data)
    return '', 200

@app.route('/api/get_packages', methods=['GET'])
def get_packages():
    result = list(queue)
    queue.clear()
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

