import express from 'express'
import expenseCtrl from '../controllers/expense.controller'
import authCtrl from '../controllers/auth.controller'

const router = express.Router()


//return expenses in current month
router.route('/api/expenses/current/preview')
    .get(authCtrl.requireSignin, expenseCtrl.currentMonthPreview)


//return avg monthly expenses and total spent 
router.route('/api/expenses/by/category')
    .get(authCtrl.requireSignin, expenseCtrl.expenseByCategory)

//return expenses incurred over a given month
    //The request will also take the value of the given month in a URL query parameter then we use it in plotExpenses
router.route('/api/expenses/plot')
    .get(authCtrl.requireSignin, expenseCtrl.plotExpenses)

//return avg expenses incurred in each category over a given time period
    //The request will also take the values of the given date range in URL query parameters then we use it in averageCategories
router.route('/api/expenses/category/averages')
    .get(authCtrl.requireSignin, expenseCtrl.averageCategories)

//return total monthly expenses incurred over a given year 
    //The request will also take the value of the given year in a URL query parameter then we use it in yearlyExpenses
router.route('/api/expenses/yearly')
    .get(authCtrl.requireSignin, expenseCtrl.yearlyExpenses)

//create new expenses
//retrieve list of expenses
router.route('/api/expenses')
    .post(authCtrl.requireSignin, expenseCtrl.create)
    .get(authCtrl.requireSignin, expenseCtrl.listByUser)


//to edit and delete expense
router.route('/api/expenses/:expenseId')
    // .get(authCtrl.requireSignin, expenseCtrl.read)
    .put(authCtrl.requireSignin, expenseCtrl.hasAuthorization, expenseCtrl.update)
    .delete(authCtrl.requireSignin, expenseCtrl.hasAuthorization, expenseCtrl.remove)

//use this param to retrieve data from the collection and attach it to req obj 
router.param('expenseId', expenseCtrl.expenseByID)

export default router