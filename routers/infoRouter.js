const express = require('express');
const infoRouter = express.Router();
const dbData = require('../database/dbData');

const GetLatestNews = async (req, res, next) => {

  try {

    const news = await dbData.LatestNews();

    res.status(200).send({
      ok: true,
      message: 'successfully retrieved latest news',
      data: news
    })

  }
  catch (error) {

    res.status(400).send({
      ok: false,
      message: 'Could not retrieve latest news: ' + error.message,
    })

  }

}

infoRouter.get('/news', GetLatestNews);

module.exports = infoRouter;