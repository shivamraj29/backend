import { Router } from "express";
import { registerUser, loginUser, logoutUser, changePassword,updateCredential, updateAvatar } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },
    {
        name: "coverImage",
        maxCount: 1
    }
]),registerUser);

router.route("/login").post(loginUser)

//logined part
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/change-password").post(verifyJWT, changePassword)
router.route("/update-credential").post(verifyJWT, updateCredential)
router.route("/update-avatar").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    }
]), verifyJWT, updateAvatar)


export default router