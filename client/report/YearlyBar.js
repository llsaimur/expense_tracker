import React, {useState, useEffect} from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import auth from '../auth/auth-helper'
import DateFnsUtils from '@date-io/date-fns'
import { DatePicker, MuiPickersUtilsProvider} from "@material-ui/pickers"
import {yearlyExpenses} from './../expense/api-expense.js'
import {VictoryTheme, VictoryAxis, VictoryBar, VictoryChart} from "victory"

const useStyles = makeStyles(theme => ({
  title: {
    padding:`32px ${theme.spacing(2.5)}px 2px`,
    color: '#2bbd7e',
    display:'inline'
  }
}))


//we render a bar chart for expenses in the curr year...
//we add DatePicker component to allow users to select a year and retrieve data for that year with a btn click


export default function Reports() {
    const classes = useStyles()
    const [error, setError] = useState('')
    const [year, setYear] = useState(new Date())
    const [yearlyExpense, setYearlyExpense] = useState([])
    const jwt = auth.isAuthenticated()
    const monthStrings = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    useEffect(() => {
        const abortController = new AbortController()
        const signal = abortController.signal
        yearlyExpenses({year: year.getFullYear()},{t: jwt.token}, signal).then((data) => {
          if (data.error) {
            setError(data.error)
          }
            setYearlyExpense(data)
        })
        return function cleanup(){
          abortController.abort()
        }
    }, [])

    const handleDateChange = date => {
        setYear(date)
        yearlyExpenses({year: date.getFullYear()},{t: jwt.token}).then((data) => {
          if (data.error) {
            setError(data.error)
          }
            setYearlyExpense(data)
        })
    }
   
    //we render data in a Victory Bar chart

        //the month values returned from db are zero-based indices
        //so we define our own array of month name string to map to these indices

    //to render the bar chart, we place a VictoryBar componenet in a VictoryChart componenet
        //alowing us to customize the bar chart wrapper,    
            //as well as the y axis with a VicotryAxis component which is added w/o props so that y-axis is not displayed...

    //we pass data to VictoryBar and define categories for the x axis values using the month strings,
        //even if a corresponding total value dne, we render individual labels for each bar to show total expense for each month
    
    //to map the x axis value with the correct month string, we specify it in the x prop for the VictoryBar component...
    return (
      <div>
          <Typography variant="h6" className={classes.title}>Your monthly expenditures in</Typography>
          <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <DatePicker value={year} onChange={handleDateChange} views={["year"]}
                disableFuture
                label="Year"
                animateYearScrolling
                variant="inline"/>
          </MuiPickersUtilsProvider>
          <VictoryChart
                theme={VictoryTheme.material}
                domainPadding={10}
                height={300}
                width={450}>
                <VictoryAxis/>
                <VictoryBar
                    categories={{
                        x: monthStrings
                    }}
                    style={{ data: { fill: "#69f0ae", width: 20 }, labels: {fill: "#01579b"} }}
                    data={yearlyExpense.monthTot}
                    x={monthStrings['x']}
                    domain={{x: [0, 13]}}
                    labels={({ datum }) => `$${datum.y}`}
                />
          </VictoryChart>
      </div>
    )
  }