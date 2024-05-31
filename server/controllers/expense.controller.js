import Expense from '../models/expense.model'
import extend from 'lodash/extend'
import errorHandler from './../helpers/dbErrorHandler'
import mongoose from 'mongoose'


//set recorded_by field to curr usr signed in before using the expense data provided in req body to save new expense in db
const create = async (req, res) => {
  try {
    req.body.recorded_by = req.auth._id
    const expense = new Expense(req.body)
    await expense.save()
    return res.status(200).json({
      message: "Expense recorded!"
    })
  } catch (err) {
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}


//returns name and id of usr that recorded the expense, using the populate() method...
const expenseByID = async (req, res, next, id) => {
    try {
      let expense = await Expense.findById(id).populate('recorded_by', '_id name').exec()
      if (!expense)
        return res.status('400').json({
          error: "Expense record not found"
        })
      req.expense = expense
      next()
    } catch (err){
      return res.status(400).json({
        error: errorHandler.getErrorMessage(err)
      })
    }
}

const read = (req, res) => {
    return res.json(req.expense)
}


//query expense collection using date range specified in req and id of signed in usr

//gather first and last day of date range specifeid in req query, then retrieve expenses incurred by usr within those days
//find query return matching expenses sorted by inccured_on field... latest expenses listed first...
const listByUser = async (req, res) => {
  let firstDay = req.query.firstDay
  let lastDay = req.query.lastDay
  try {
    let expenses = await Expense.find({'$and':[{'incurred_on':{'$gte': firstDay, '$lte':lastDay}}, {'recorded_by': req.auth._id}]}).sort('incurred_on').populate('recorded_by', '_id name')
    res.json(expenses)
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}


//we will use mongo aggregation framework to perform three sets of aggregations on the Expense collection to retrieve total for curr month, day and day before...
const currentMonthPreview = async (req, res) => {

    //we determine the dates needed to find matchin expenses
    //then perform aggregagtions
  const date = new Date(), y = date.getFullYear(), m = date.getMonth()
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)

  
  const today = new Date()
  today.setUTCHours(0,0,0,0)
  
  const tomorrow = new Date()
  tomorrow.setUTCHours(0,0,0,0)
  tomorrow.setDate(tomorrow.getDate()+1)
  
  const yesterday = new Date()
  yesterday.setUTCHours(0,0,0,0)
  yesterday.setDate(yesterday.getDate()-1)
  
  //with thse dates, and signed in usr id reference...
    //construct agregation pipelines to retrieve total for month, day, yesterday
        //we group these three diff agregation piples using $facet stage in mongo aggregation framework
  try {
    let currentPreview = await Expense.aggregate([
      {

        //for each pipeline, we match the expenses using date range values for the incurred_on field and recorded_by field with curr usr reference
            //to make sure the aggregation is only performed on data recorder by curr user,
                //then matching expenses in each pipeline are grouped to calculate total amount spent...
          $facet: { month: [
                              { $match : { incurred_on : { $gte : firstDay, $lt: lastDay }, recorded_by: mongoose.Types.ObjectId(req.auth._id)}},
                              { $group : { _id : "currentMonth" , totalSpent:  {$sum: "$amount"} } },
                            ],
                    today: [
                      { $match : { incurred_on : { $gte : today, $lt: tomorrow }, recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
                      { $group : { _id : "today" , totalSpent:  {$sum: "$amount"} } },
                    ],
                    yesterday: [
                      { $match : { incurred_on : { $gte : yesterday, $lt: today }, recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
                      { $group : { _id : "yesterday" , totalSpent:  {$sum: "$amount"} } },
                    ]
                  }
      }])

      //In the faceted aggregation operation result, each pipeline has its own field in the output document where the results are stored as an array of documents

      //after operations are completed, we access the results and build response to be sent back in the response to the requesting client...
    let expensePreview = {month: currentPreview[0].month[0], today: currentPreview[0].today[0], yesterday: currentPreview[0].yesterday[0] }
    res.json(expensePreview)
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}

//we will use diff featue to seperately calculate monthly expenses avg for each category and total spent in curr month per category
    //before combining the two results to return these two values associated with each category to the requesting client
const expenseByCategory = async (req, res) => {

    // determine the dates required to find matching expenses,
  const date = new Date(), y = date.getFullYear(), m = date.getMonth()
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)


  // here we will use $facet with two sub-pipelines to calculate monthly avg per category and total spent per category for the month
  try {
    let categoryMonthlyAvg = await Expense.aggregate([
      {
        $facet: {
            average: [
              { $match : { recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
              { $group : { _id : {category: "$category", month: {$month: "$incurred_on"}}, totalSpent:  {$sum: "$amount"} } },
              { $group: { _id: "$_id.category", avgSpent: { $avg: "$totalSpent"}}},
              {
                  $project: {
                    _id: "$_id", value: {average: "$avgSpent"},
                  }
              }
            ],
            total: [
              { $match : { incurred_on : { $gte : firstDay, $lte: lastDay }, recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
              { $group : { _id : "$category", totalSpent:  {$sum: "$amount"} } },
              {
                $project: {
                  _id: "$_id", value: {total: "$totalSpent"},
                }
              }
            ]
        }
      },
      //then we take these two resulting arrays from the sub-pipelines to merge the results...
      //while projecting output, we make sure the keys of the result obj are _id and value in both output arrays
        //so they can merge uniformly

      //when operations is complete, we use $setUnion on the results to combine arrays
      {
        $project: {
          overview: { $setUnion:['$average','$total'] },
        }
      },
      
      //then we make resulting combine array the new root document in order to run a $group aggregation on it
      //to merger the values for the avg and totals per category
      {$unwind: '$overview'},
      {$replaceRoot: { newRoot: "$overview" }},
      { $group: { _id: "$_id", mergedValues: { $mergeObjects: "$value" } } }
    ]).exec()
    //the final output will contain an array with an obj for each expense category,
        //each obj will have the category name as the _id value and a mergedValues ovj containting the avg and total values for the category
            //sent back in the response to the requesting client
    res.json(categoryMonthlyAvg)
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}

//to determine the dates of the first and last day of the provided range
//we need these dates to specify the range for finding the matching expenses incurred in the specified date range
//and recorded by authenticated usr while aggregating the expense averages per category into the data format needed for the chart...


//run an aggregation operation that finds matching expenses
    //groups data by category to first calculate the total, then avg
        //and returns an output containing the values in the format needed for y and x values of pie chart


const averageCategories = async (req, res) => {
  const firstDay = new Date(req.query.firstDay)
  const lastDay = new Date(req.query.lastDay)

  try {
    let categoryMonthlyAvg = await Expense.aggregate([
      { $match : { incurred_on : { $gte : firstDay, $lte: lastDay }, recorded_by: mongoose.Types.ObjectId(req.auth._id)}},
      { $group : { _id : {category: "$category"}, totalSpent:  {$sum: "$amount"} } },
      { $group: { _id: "$_id.category", avgSpent: { $avg: "$totalSpent"}}},
      { $project: {x: '$_id', y: '$avgSpent'}}
    ]).exec()

    //result contains array objs
        //x = category name as the value
        //y = corresponding avg expense amount for that category
    //sent back in the response to the requesting client...
    res.json({monthAVG:categoryMonthlyAvg})
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}

//to determine the dates of the first and last day of the provided year
//we need these dates to specify the range for finding the mathcing expenses that were incurred in the specified year
//and recorded by the authenticare usr while aggregating the total monthly expenses into the data format needed for the chart...

//run aggregation operation that finds matching expenses,
    //groups the data by month to calculate the total
        //then returns output containing the values in the format for y/x axis...


const yearlyExpenses = async (req, res) => {
  const y = req.query.year
  const firstDay = new Date(y, 0, 1)
  const lastDay = new Date(y, 12, 0)
  try {
    let totalMonthly = await Expense.aggregate(  [
      { $match: { incurred_on: { $gte : firstDay, $lt: lastDay }, recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
      { $group: { _id: {$month: "$incurred_on"}, totalSpent:  {$sum: "$amount"} } },
      { $project: {x: '$_id', y: '$totalSpent'}}
    ]).exec()
    //result contains an array of objs
        //x = month value from the incurred_on date
        //y = total expense amount for that month
    //sent back in the response to the requesting client...
    res.json({monthTot:totalMonthly})
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}

//to determine the dates of the first and last day of the provided month
//we need these dates to specify the range for finding the matchin expense that were incured in the specified month 
//and recorded by the authenticated usr while aggregating the expenses into the data format needed for the chart


//we run a aggregation operation that find matching expenses
    //and return output with values in format needed for y axis and x axis values of the scatter plot...
const plotExpenses = async (req, res) => {
  const date = new Date(req.query.month), y = date.getFullYear(), m = date.getMonth()
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)

  try {
    let totalMonthly = await Expense.aggregate(  [
      { $match: { incurred_on: { $gte : firstDay, $lt: lastDay }, recorded_by: mongoose.Types.ObjectId(req.auth._id) }},
      { $project: {x: {$dayOfMonth: '$incurred_on'}, y: '$amount'}}
    ]).exec()

    //the result containts an array of objs, each obj contains an x and y attribute
        //x = day of the month from incurred_on date
        //y = corresponding expense amount
    //then sent back in the response to the requesting client...
    res.json(totalMonthly)
  } catch (err){
    console.log(err)
    return res.status(400).json({
      error: errorHandler.getErrorMessage(err)
    })
  }
}


//retrives data from req.expense, then uses lodash module to extend and merge changes from the req body to update the expense data...
//before saving to db, the updated field is populated with curr date to reflect the last updated timestamp...
  const update = async (req, res) => {
    try {
      let expense = req.expense
      expense = extend(expense, req.body)
      expense.updated = Date.now()
      await expense.save()
      res.json(expense)
    } catch (err) {
      return res.status(400).json({
        error: errorHandler.getErrorMessage(err)
      })
    }
  }
  
const remove = async (req, res) => {
    try {
      let expense = req.expense
      let deletedExpense = await expense.remove()
      res.json(deletedExpense)
    } catch (err) {
      return res.status(400).json({
        error: errorHandler.getErrorMessage(err)
      })
    }
}



const hasAuthorization = (req, res, next) => {
  const authorized = req.expense && req.auth && req.expense.recorded_by._id == req.auth._id
  if (!(authorized)) {
    return res.status('403').json({
      error: "User is not authorized"
    })
  }
  next()
}

export default {
    create,
    expenseByID,
    read,
    currentMonthPreview,
    expenseByCategory,
    averageCategories,
    yearlyExpenses,
    plotExpenses,
    listByUser,
    remove,
    update,
    hasAuthorization
}