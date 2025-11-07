import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/users.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import cloudinary from "cloudinary"
import jwt from "jsonwebtoken"


//delete photo from cloudinary
const deleteFromCloudinary = async(url) => {
    try {
        const parts = url.split("/upload/")[1];
        const withoutVersion = parts.substring(parts.indexOf("/") + 1);
        const publicId = withoutVersion.split(".")[0];
        
        await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        });
    } catch (error) {
        console.log("error occured while deleting", error)
    }
}



// generate access and refresh token

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken, refreshToken}
    } catch (error) {
        console.log("Token couldnt be generated" , error)
    }

}


const registerUser =  asyncHandler(async (req, res ) => {
    
    const {username, fullName, email, password} = req.body

    // taking input from frontend
    if([username, fullName, email, password].some(field => field.trim === "")){
        throw new ApiError(400, "All fields are required")
    }
    // checking if the user already exists
    const existingUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existingUser) throw new ApiError(409, "Username/Email already exists");

    //getting path{to which multer already uploaded the file} from request
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    if(!avatarLocalPath) throw new ApiError(400, "Avatar is required");

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // adding user to database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) throw new ApiError(500, "Something went wrong");
   
    
    //response returning created user
    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered")
    )

})

//Login user
const loginUser = asyncHandler(async (req,res)=> {
    console.log(req.body)
    //take input from frontend
    const {username, email, password} = req.body

    //validate username email and password

    if(!username && !email) throw new ApiError(408, "username/email required");
    if(!password) throw new ApiError(408, "password required");

    //find the username from database

    const user = await User.findOne({
        $or : [{username} , {email}]
    })

    if(!user) throw new ApiError(400, "User doesnt exist");

    const validPassword = await user.isPasswordCorrect(password)

    //check password is correct
    if(!validPassword) throw new ApiError(401, "Password incorrect");

    //if correct generate tokens
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    
    //save tokens in cookie and res to frontend

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }
    
    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in"
            )
        )
    


})

//logout user
const logoutUser = asyncHandler(async (req,res) => {
    //taking data of user from the middleware verifyJWT(it takes data from cookie)
    const user = req.user
    //deleting the refresh token
    await User.findByIdAndUpdate(user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    //clear cookies and send response
    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"))

})
//update pass

const changePassword = asyncHandler(async(req,res) => {

    //as the user is logged in we already have verified it by the auth middleware and we can have the user detail by the method req.user
    const {oldPassword, newPassword} = req.body
    
    const currentUser = await User.findById(req.user._id)
    const validPass = await currentUser.isPasswordCorrect(oldPassword)

    if(!validPass) return new ApiError(402, "Password invalid");

    currentUser.password = newPassword
    currentUser.save({validateBeforeSave: false})

    return res.status(200)
    .json(new ApiResponse(200,{}, "Password changed successfully"))
})

//update credentials

const updateCredential = asyncHandler(async(req,res) => {
    //get fields what the user wants to change
    const {username, fullName, email} = req.body

    if([username, fullName, email].some(field => field.trim() === "")) throw ApiError(401, "All fields are required");

    const currentUser = await User.findById(req.user._id)
    //check if username or email already exists
    if(currentUser.username!== username ){
        const isNotUnique = await User.findOne({username})
        if(isNotUnique) throw new ApiError(409, "username already exists")
    }
    
    if(currentUser.email!== email ){
        const isNotUnique = await User.findOne({email})
        if(isNotUnique) throw new ApiError(409, "email already exists")
    }

    currentUser.username = username
    currentUser.fullName= fullName
    currentUser.email = email
    currentUser.save({validateBeforeSave: false})
    
    return res.status(200)
    .json( new ApiResponse(200, {username, fullName, email}, "Credentials changed"))
})


//update avatar
const updateAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.files?.avatar[0].path

    if(!avatarLocalPath) throw new ApiError(400, "file not found")
    //upload it on cloudinary and delete the existing one
    //take the response from cloudinary and add it in url
    const user = await User.findById(req.user._id).select("-password -refreshToken")
    const existingAvatar = user.avatar

    const uploadAvatar = await uploadOnCloudinary(avatarLocalPath)

    if(!uploadAvatar) throw new ApiError(400, "Couldnt upload avatar")

    user.avatar = uploadAvatar.url
    user.save({validateBeforeSave: false})
    await deleteFromCloudinary(existingAvatar)
    
    return res.status(200)
    .json(new ApiResponse(200,user, "Avatar Changed"))

})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const token = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "")
    const decodeToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decodeToken._id)
    
    if(user.refreshToken !== decodeToken) throw new ApiError(400, "Unauthorized request");

    const accessToken = user.generateAccessToken()

    const options = {
        httpOnly: true,
        secure:true
    }
    return res.status(200)
    .cookie("accessToken" , accessToken)
    .json(new ApiResponse(200, {
        
    }))

})




export {registerUser, loginUser, logoutUser, changePassword,updateCredential, updateAvatar}