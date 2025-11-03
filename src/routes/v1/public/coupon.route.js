const express = require('express');
const validate = require('../../../middlewares/validate');
const couponValidation = require('../../../validations/coupon.validation');
const couponController = require('../../../controllers/coupon.controller');
const queryMiddleware = require('../../../middlewares/queryMiddleware.js');

const router = express.Router();

router.get('/', validate(couponValidation.paginate), queryMiddleware, paginate, couponController.paginate);
router.get('/available', queryMiddleware, couponController.available);

module.exports = router;

function paginate(req, res, next) {
    if (req.query.minPrice && req.query.maxPrice && req.query.minPrice > req.query.maxPrice) {
        return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
    }   

    if (req.query.minPrice || req.query.minPrice === 0) {
        req.query.basePrice = { ...req.query.basePrice, $gte: Number(req.query.minPrice) };
        delete req.query.minPrice;
    }   
    if (req.query.maxPrice || req.query.maxPrice === 0) {
        req.query.basePrice = { ...req.query.basePrice, $lte: Number(req.query.maxPrice) };
        delete req.query.maxPrice;
    }

    if (req.options && req.options.sortBy) {
        if (req.options.sortBy === 'popular') {
            delete req.options.sortBy;
        } else if (req.options.sortBy === 'rating') {
            delete req.options.sortBy;
        } else if (req.options.sortBy === 'price:asc') {
            req.options.sortBy = 'basePrice:asc';
        } else if (req.options.sortBy === 'price:desc') {
            req.options.sortBy = 'basePrice:desc';
        } else {
            delete req.options.sortBy;
        }
    }

    if (req.query.search) {
        req.query.$or = [
            { name: { $regex: req.query.search, $options: 'i' } },
            { description: { $regex: req.query.search, $options: 'i' } },
        ];
    }

    next();
}
