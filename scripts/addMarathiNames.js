const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log("Connected to MongoDB");
  const db = mongoose.connection.db;

  const stopTranslations = {
    // Route 77 stops
    "Railway Station": "रेल्वे स्थानक",
    "Railway Station ": "रेल्वे स्थानक",
    "Shivaji chowk": "शिवाजी चौक",
    "Samrat Chouk": "सम्राट चौक",
    "Samrat Chouk ": "सम्राट चौक",
    "Tulajapur Ves": "तुळजापूर वेस",
    "Tulajapur Ves ": "तुळजापूर वेस",
    "Kumbhar Ves": "कुंभार वेस",
    "Kumbhar Ves ": "कुंभार वेस",
    "Dayanand College": "दयानंद कॉलेज",
    "Boramani Naka": "बोरामणी नाका",
    "Market Yard": "मार्केट यार्ड",
    "Bagwan Nagar": "बागवान नगर",
    "Bagwan Nagar ": "बागवान नगर",
    "Momin Nagar": "मोमीन नगर",
    "Momin Nagar ": "मोमीन नगर",
    "Mulegoan": "मुळेगाव",
    "Doddi": "डोड्डी",
    "Naala": "नाला",
    "Naala ": "नाला",
    "Darganhalli": "दर्गनहळ्ळी",
    "Paani taki": "पाणी टाकी",
    "Paani taki ": "पाणी टाकी",
    "Vasti": "वस्ती",
    "Vasti ": "वस्ती",
    "Dhotri": "धोत्री",
    "Dhotri ": "धोत्री",
    "Gokul Sugar factory": "गोकुळ साखर कारखाना",
    "Gokul Sugar factory ": "गोकुळ साखर कारखाना",
    "Boregoan": "बोरेगाव",
    "Akatnaal fata": "अकतनाळ फाटा",
    "Akatnaal fata ": "अकतनाळ फाटा",
    "Pitapur": "पिटापूर",
    "Nil": "निळ",
    "Nil ": "निळ",
    "Nanhegoan": "नानहेगाव",
    // Route 83B stops
    "Khadaki Dhotri": "खडकी धोत्री",
    // Route Rajendra Chowk - Wadgaon stops
    "Rajendra Chowk": "राजेंद्र चौक",
    "Kanna Chowk": "कन्ना चौक",
    "Kontam Chowk": "कोंताम चौक",
    "Balives": "बालीवेस",
    "Shivaji Chowk": "शिवाजी चौक",
    "Juna Puna Naka": "जुना पुणे नाका",
    "Bale Corner": "बाळे कॉर्नर",
    "Ambika Nagar": "अंबिका नगर",
    "Mardi Fata": "मार्डी फाटा",
    "Bhogaon": "भोगाव",
    "Ganapati": "गणपती",
    "Banegaon": "बानेगाव",
    "Lodhi Wasti": "लोधी वस्ती",
    "Mardi": "मार्डी",
    "Kashid Mala": "काशीद माळ",
    "Narotewadi": "नारोटेवाडी",
    "Odha": "ओढा",
    "Wadgaon": "वाडगाव",
  };

  const routes = await db.collection("routes").find({}).toArray();
  let updatedCount = 0;

  for (const route of routes) {
    if (!route.trips || route.trips.length === 0) continue;
    let modified = false;
    const updatedTrips = route.trips.map(trip => {
      const updatedStops = trip.stops.map(stop => {
        const marathi = stopTranslations[stop.name] || stopTranslations[stop.name?.trim()];
        if (marathi && !stop.nameMarathi) {
          modified = true;
          return { ...stop, nameMarathi: marathi };
        }
        return stop;
      });
      return { ...trip, stops: updatedStops };
    });

    if (modified) {
      await db.collection("routes").updateOne(
        { _id: route._id },
        { $set: { trips: updatedTrips } }
      );
      updatedCount++;
      console.log(`Updated route: ${route.source} -> ${route.destination}`);
    }
  }

  // Also update stops array directly (for routes without trips)
  const allRoutes = await db.collection("routes").find({}).toArray();
  for (const route of allRoutes) {
    if (!route.stops || route.stops.length === 0) continue;
    let modified = false;
    const updatedStops = route.stops.map(stop => {
      const marathi = stopTranslations[stop.name] || stopTranslations[stop.name?.trim()];
      if (marathi && !stop.nameMarathi) {
        modified = true;
        return { ...stop, nameMarathi: marathi };
      }
      return stop;
    });
    if (modified) {
      await db.collection("routes").updateOne(
        { _id: route._id },
        { $set: { stops: updatedStops } }
      );
      updatedCount++;
      console.log(`Updated route stops: ${route.source} -> ${route.destination}`);
    }
  }

  console.log(`Done! Updated ${updatedCount} routes.`);
  mongoose.disconnect();
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});